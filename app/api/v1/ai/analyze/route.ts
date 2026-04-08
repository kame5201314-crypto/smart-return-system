import { format } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';

import { isAuthenticatedRequest } from '@/lib/auth/request-auth';
import { createAdminClient, createUntypedAdminClient } from '@/lib/supabase/admin';

interface ReturnAnalysisData {
  request_number: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  refund_amount: number | null;
  refund_type: string;
  return_items?: {
    product_name: string;
    sku: string;
    quantity: number;
    reason: string;
  }[];
  inspection_records?: {
    result: string | null;
    condition_grade: string | null;
    inspector_comment: string | null;
  }[];
}

interface ShopeeReturnData {
  id: string;
  order_number: string;
  order_date: string | null;
  total_price: number;
  product_name: string | null;
  option_name: string | null;
  activity_price: number;
  option_sku: string | null;
  return_quantity: number;
  refund_amount: number | null;
  return_reason: string | null;
  buyer_note: string | null;
  shipping_method: string | null;
  platform: string | null;
  is_processed: boolean;
  note: string | null;
  created_at: string;
}

interface PickupRecordData {
  id: string;
  process_date: string;
  order_number: string;
  tracking_number: string | null;
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  notes: string | null;
  receiver_info: string | null;
  created_at: string;
}

interface LegacyStatistics {
  totalReturns?: unknown;
  total_returns?: unknown;
  totalRefundAmount?: unknown;
  total_refund_amount?: unknown;
  storeCreditRate?: unknown;
  store_credit_rate?: unknown;
}

interface PainPoint {
  issue: string;
  frequency: string;
  impact: string;
  affected_products: string[];
}

interface Recommendation {
  title: string;
  description: string;
  priority: string;
  category: string;
}

interface SkuAnalysisEntry {
  sku: string;
  product_name: string;
  return_count: number;
  return_rate: string;
  main_issues: string[];
  suggestion: string;
}

interface ChannelAnalysisEntry {
  channel: string;
  return_count: number;
  common_issues: string[];
}

interface AnalysisResult {
  summary: string;
  pain_points: PainPoint[];
  recommendations: Recommendation[];
  sku_analysis: SkuAnalysisEntry[];
  channel_analysis: ChannelAnalysisEntry[];
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeLegacyReportStatistics(report: Record<string, unknown>) {
  const statistics =
    report.statistics && typeof report.statistics === 'object'
      ? (report.statistics as LegacyStatistics)
      : null;

  const fallbackTotalReturns = toNumberOrNull(
    statistics?.totalReturns ?? statistics?.total_returns
  );
  const fallbackTotalRefundAmount = toNumberOrNull(
    statistics?.totalRefundAmount ?? statistics?.total_refund_amount
  );
  const fallbackStoreCreditRate = toNumberOrNull(
    statistics?.storeCreditRate ?? statistics?.store_credit_rate
  );

  return {
    ...report,
    total_returns:
      toNumberOrNull(report.total_returns) ?? fallbackTotalReturns,
    total_refund_amount:
      toNumberOrNull(report.total_refund_amount) ?? fallbackTotalRefundAmount,
    store_credit_rate:
      toNumberOrNull(report.store_credit_rate) ?? fallbackStoreCreditRate,
  };
}

function classifyLevel(count: number, total: number) {
  if (total <= 0) return 'low';
  const ratio = count / total;
  if (ratio >= 0.35 || count >= 10) return 'high';
  if (ratio >= 0.15 || count >= 4) return 'medium';
  return 'low';
}

function toDisplayLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function isAbnormalPickupStatus(status: string | null | undefined) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return (
    normalized.includes('退回') ||
    normalized.includes('失敗') ||
    normalized.includes('未') ||
    normalized.includes('異常') ||
    normalized.includes('cancel') ||
    normalized.includes('return') ||
    normalized.includes('failed')
  );
}

async function listAvailableModels(apiKey: string): Promise<string[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    console.error('Failed to list models:', await response.text());
    return [];
  }

  const data = await response.json();
  return data.models?.map((model: { name: string }) => model.name) || [];
}

async function callGeminiAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const availableModels = await listAvailableModels(apiKey);
  const preferredModels = [
    'models/gemini-2.0-flash',
    'models/gemini-2.0-flash-lite',
    'models/gemini-flash-latest',
    'models/gemini-pro-latest',
  ];

  let modelToUse = 'models/gemini-2.0-flash';
  for (const preferred of preferredModels) {
    if (availableModels.includes(preferred)) {
      modelToUse = preferred;
      break;
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (model: ${modelToUse}, available: ${availableModels.join(
        ', '
      )}): ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function buildFallbackAnalysis(params: {
  period: string;
  returns: ReturnAnalysisData[];
  shopeeReturns: ShopeeReturnData[];
  pickupRecords: PickupRecordData[];
  totalReturns: number;
  totalRefundAmount: number;
}) {
  const {
    period,
    returns,
    shopeeReturns,
    pickupRecords,
    totalReturns,
    totalRefundAmount,
  } = params;

  const reasonCounts = new Map<
    string,
    { count: number; products: Set<string> }
  >();
  const skuCounts = new Map<
    string,
    {
      sku: string;
      product_name: string;
      return_count: number;
      reasons: Map<string, number>;
    }
  >();
  const channelCounts = new Map<
    string,
    { count: number; issues: Map<string, number> }
  >();

  for (const item of returns) {
    const reason = toDisplayLabel(
      item.reason_detail || item.reason_category,
      '退貨原因待補'
    );
    const reasonEntry = reasonCounts.get(reason) ?? {
      count: 0,
      products: new Set<string>(),
    };
    reasonEntry.count += 1;

    for (const product of item.return_items ?? []) {
      if (product.product_name) {
        reasonEntry.products.add(product.product_name);
      }

      const skuKey = product.sku || product.product_name || item.request_number;
      const skuEntry = skuCounts.get(skuKey) ?? {
        sku: product.sku || '未填 SKU',
        product_name: product.product_name || '未命名商品',
        return_count: 0,
        reasons: new Map<string, number>(),
      };
      skuEntry.return_count += product.quantity || 1;

      const productReason = toDisplayLabel(product.reason, reason);
      skuEntry.reasons.set(
        productReason,
        (skuEntry.reasons.get(productReason) ?? 0) + (product.quantity || 1)
      );

      skuCounts.set(skuKey, skuEntry);
    }

    reasonCounts.set(reason, reasonEntry);

    const channel = toDisplayLabel(item.channel_source, '退貨管理');
    const channelEntry = channelCounts.get(channel) ?? {
      count: 0,
      issues: new Map<string, number>(),
    };
    channelEntry.count += 1;
    channelEntry.issues.set(reason, (channelEntry.issues.get(reason) ?? 0) + 1);
    channelCounts.set(channel, channelEntry);
  }

  for (const item of shopeeReturns) {
    const reason = toDisplayLabel(item.return_reason || item.buyer_note, '蝦皮退貨');
    const reasonEntry = reasonCounts.get(reason) ?? {
      count: 0,
      products: new Set<string>(),
    };
    reasonEntry.count += 1;
    if (item.product_name) {
      reasonEntry.products.add(item.product_name);
    }
    reasonCounts.set(reason, reasonEntry);

    const skuKey = item.option_sku || item.product_name || item.order_number;
    const skuEntry = skuCounts.get(skuKey) ?? {
      sku: item.option_sku || '未填 SKU',
      product_name: item.product_name || item.option_name || '未命名商品',
      return_count: 0,
      reasons: new Map<string, number>(),
    };
    skuEntry.return_count += item.return_quantity || 1;
    skuEntry.reasons.set(
      reason,
      (skuEntry.reasons.get(reason) ?? 0) + (item.return_quantity || 1)
    );
    skuCounts.set(skuKey, skuEntry);

    const channel = item.platform === 'mall' ? '蝦皮商城' : '蝦皮';
    const channelEntry = channelCounts.get(channel) ?? {
      count: 0,
      issues: new Map<string, number>(),
    };
    channelEntry.count += 1;
    channelEntry.issues.set(reason, (channelEntry.issues.get(reason) ?? 0) + 1);
    channelCounts.set(channel, channelEntry);
  }

  const abnormalPickups = pickupRecords.filter(
    (item) =>
      isAbnormalPickupStatus(item.delivery_status) ||
      isAbnormalPickupStatus(item.received_status)
  );

  for (const item of pickupRecords) {
    const channel = `物流/${toDisplayLabel(item.platform, item.logistics_provider || '未分類')}`;
    const issue = isAbnormalPickupStatus(item.delivery_status)
      ? `物流狀態：${toDisplayLabel(item.delivery_status, '異常')}`
      : isAbnormalPickupStatus(item.received_status)
      ? `收件狀態：${toDisplayLabel(item.received_status, '異常')}`
      : '物流流程正常';
    const channelEntry = channelCounts.get(channel) ?? {
      count: 0,
      issues: new Map<string, number>(),
    };
    channelEntry.count += 1;
    channelEntry.issues.set(issue, (channelEntry.issues.get(issue) ?? 0) + 1);
    channelCounts.set(channel, channelEntry);
  }

  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  const skuAnalysis = [...skuCounts.values()]
    .sort((a, b) => b.return_count - a.return_count)
    .slice(0, 20)
    .map<SkuAnalysisEntry>((sku) => {
      const sortedReasons = [...sku.reasons.entries()].sort((a, b) => b[1] - a[1]);
      const mainIssues = sortedReasons.slice(0, 3).map(([reason]) => reason);
      return {
        sku: sku.sku,
        product_name: sku.product_name,
        return_count: sku.return_count,
        return_rate:
          totalReturns > 0
            ? `${((sku.return_count / totalReturns) * 100).toFixed(1)}%`
            : '0.0%',
        main_issues: mainIssues,
        suggestion:
          mainIssues.length > 0
            ? `優先檢查「${mainIssues[0]}」對應的商品描述、出貨品質與客服話術。`
            : '建議持續追蹤此商品的退貨原因與客服處理紀錄。',
      };
    });

  const channelAnalysis = [...channelCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map<ChannelAnalysisEntry>(([channel, data]) => ({
      channel,
      return_count: data.count,
      common_issues: [...data.issues.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([issue]) => issue),
    }));

  const painPoints: PainPoint[] = topReasons.map(([reason, data]) => ({
    issue: reason,
    frequency: classifyLevel(data.count, totalReturns),
    impact: classifyLevel(data.count, totalReturns),
    affected_products: [...data.products].slice(0, 5),
  }));

  if (abnormalPickups.length > 0) {
    painPoints.push({
      issue: '物流與收件狀態異常',
      frequency: classifyLevel(abnormalPickups.length, pickupRecords.length || 1),
      impact: abnormalPickups.length >= 3 ? 'high' : 'medium',
      affected_products: abnormalPickups
        .map((item) => item.order_number)
        .filter(Boolean)
        .slice(0, 5),
    });
  }

  const recommendations: Recommendation[] = [];
  if (topReasons[0]) {
    recommendations.push({
      title: `優先改善「${topReasons[0][0]}」相關退貨`,
      description:
        '請先回查商品頁描述、客服溝通內容與出貨檢查紀錄，確認是否有共同錯誤訊息或規格落差。',
      priority: 'high',
      category: 'customer_service',
    });
  }

  if (skuAnalysis[0]) {
    recommendations.push({
      title: `鎖定高退貨 SKU：${skuAnalysis[0].product_name}`,
      description:
        '請檢查此商品的近 30 天出貨批次、包裝狀況與 FAQ，必要時先調整商品頁說明或暫停推廣。',
      priority: 'high',
      category: 'product',
    });
  }

  if (abnormalPickups.length > 0) {
    recommendations.push({
      title: '追蹤物流異常與未收件案件',
      description:
        '請整理異常物流商與狀態類型，優先處理已退回、配送失敗與未簽收案件，避免退貨週期拉長。',
      priority: 'medium',
      category: 'logistics',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: '持續追蹤退貨原因分布',
      description:
        '目前沒有明顯單一異常，建議持續觀察前 3 大退貨原因並建立固定月報，避免問題累積。',
      priority: 'medium',
      category: 'marketing',
    });
  }

  const topReasonLabel = topReasons[0]?.[0] ?? '尚無明顯集中原因';
  const topReasonCount = topReasons[0]?.[1].count ?? 0;
  const topSkuLabel = skuAnalysis[0]?.product_name ?? '尚無高風險商品';
  const abnormalPickupText =
    abnormalPickups.length > 0
      ? `另有 ${abnormalPickups.length} 筆物流或收件狀態異常案件需要優先處理。`
      : '本月物流與收件流程整體穩定。';

  return {
    summary:
      `${period} 共整理 ${totalReturns} 筆退貨資料，退款金額約 NT$ ${totalRefundAmount.toLocaleString()}。` +
      `最主要的退貨原因是「${topReasonLabel}」(${topReasonCount} 筆)，` +
      `高風險商品以「${topSkuLabel}」最需要優先追蹤。${abnormalPickupText}`,
    pain_points: painPoints.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
    sku_analysis: skuAnalysis,
    channel_analysis: channelAnalysis,
  } satisfies AnalysisResult;
}

function buildAnalysisPrompt(params: {
  period: string;
  returns: ReturnAnalysisData[];
  shopeeReturns: ShopeeReturnData[];
  pickupRecords: PickupRecordData[];
  totalDataCount: number;
}) {
  const { period, returns, shopeeReturns, pickupRecords, totalDataCount } = params;

  const returnAnalysisData = returns.map((r) => ({
    source: '退貨管理',
    request_number: r.request_number,
    channel: r.channel_source,
    reason_category: r.reason_category,
    reason_detail: r.reason_detail,
    refund_amount: r.refund_amount,
    products: r.return_items?.map((item) => ({
      name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      reason: item.reason,
    })),
    inspection: r.inspection_records?.[0]
      ? {
          result: r.inspection_records[0].result,
          grade: r.inspection_records[0].condition_grade,
          comment: r.inspection_records[0].inspector_comment,
        }
      : null,
  }));

  const shopeeAnalysisData = shopeeReturns.map((r) => ({
    source: r.platform === 'mall' ? '蝦皮商城' : '蝦皮',
    order_number: r.order_number,
    product_name: r.product_name,
    option_name: r.option_name,
    sku: r.option_sku,
    return_quantity: r.return_quantity,
    refund_amount: r.refund_amount,
    return_reason: r.return_reason,
    buyer_note: r.buyer_note,
    admin_note: r.note,
    is_processed: r.is_processed,
  }));

  const pickupAnalysisData = pickupRecords.map((r) => ({
    source: '派車收件',
    order_number: r.order_number,
    platform: r.platform,
    logistics_provider: r.logistics_provider,
    delivery_status: r.delivery_status,
    received_status: r.received_status,
    notes: r.notes,
  }));

  return `你是一位退貨營運分析顧問，請分析 ${period} 的退貨資料，輸出可執行的商業洞察。

===== 資料量摘要 =====
- 退貨管理：${returns.length} 筆
- 蝦皮退貨：${shopeeReturns.length} 筆
- 派車收件：${pickupRecords.length} 筆
- 總計：${totalDataCount} 筆

===== 退貨管理資料 =====
${returnAnalysisData.length > 0 ? JSON.stringify(returnAnalysisData, null, 2) : '無資料'}

===== 蝦皮退貨資料（含買家備註） =====
${shopeeAnalysisData.length > 0 ? JSON.stringify(shopeeAnalysisData, null, 2) : '無資料'}

===== 派車收件資料 =====
${pickupAnalysisData.length > 0 ? JSON.stringify(pickupAnalysisData, null, 2) : '無資料'}

請僅回傳 JSON，格式如下：
{
  "summary": "150 字內的總結",
  "pain_points": [
    {
      "issue": "問題名稱",
      "frequency": "high/medium/low",
      "impact": "high/medium/low",
      "affected_products": ["商品名稱"]
    }
  ],
  "recommendations": [
    {
      "title": "建議標題",
      "description": "具體建議",
      "priority": "high/medium/low",
      "category": "product/logistics/customer_service/marketing"
    }
  ],
  "sku_analysis": [
    {
      "sku": "SKU",
      "product_name": "商品名稱",
      "return_count": 10,
      "return_rate": "12.3%",
      "main_issues": ["主要問題"],
      "suggestion": "建議作法"
    }
  ],
  "channel_analysis": [
    {
      "channel": "通路名稱",
      "return_count": 5,
      "common_issues": ["常見問題"]
    }
  ]
}

規則：
1. sku_analysis 只保留退貨量最高的前 20 項。
2. summary 請明確點出最主要退貨原因、關鍵 SKU 與物流異常。
3. 若買家備註中出現重複抱怨，請反映在 pain_points 與 recommendations。
4. channel_analysis 請依實際通路分群，不要混淆退貨管理、蝦皮與派車收件來源。
5. 不要輸出 markdown、說明文字或 code fence。`;
}

function normalizeAnalysisResult(
  analysis: Partial<AnalysisResult>,
  fallback: AnalysisResult
): AnalysisResult {
  return {
    summary: analysis.summary?.trim() || fallback.summary,
    pain_points:
      Array.isArray(analysis.pain_points) && analysis.pain_points.length > 0
        ? analysis.pain_points
        : fallback.pain_points,
    recommendations:
      Array.isArray(analysis.recommendations) &&
      analysis.recommendations.length > 0
        ? analysis.recommendations
        : fallback.recommendations,
    sku_analysis:
      Array.isArray(analysis.sku_analysis) && analysis.sku_analysis.length > 0
        ? analysis.sku_analysis
        : fallback.sku_analysis,
    channel_analysis:
      Array.isArray(analysis.channel_analysis) &&
      analysis.channel_analysis.length > 0
        ? analysis.channel_analysis
        : fallback.channel_analysis,
  };
}

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await isAuthenticatedRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '未登入或登入已失效' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { period } = body as { period?: string };

    if (!period) {
      return NextResponse.json(
        { success: false, error: '缺少分析月份參數' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const untypedSupabase = createUntypedAdminClient();

    const startDate = `${period}-01`;
    const endDate = format(
      new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
      'yyyy-MM-dd'
    );

    let returns: ReturnAnalysisData[] = [];
    const fullQuery = await supabase
      .from('return_requests')
      .select(
        `
        *,
        return_items (
          product_name,
          sku,
          quantity,
          reason
        ),
        inspection_records (
          result,
          condition_grade,
          inspector_comment
        )
      `
      )
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (fullQuery.error) {
      console.warn('Full query failed, trying basic query:', fullQuery.error.message);
      const basicQuery = await supabase
        .from('return_requests')
        .select('*')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (!basicQuery.error) {
        returns = basicQuery.data as ReturnAnalysisData[];
      }
    } else {
      returns = fullQuery.data as ReturnAnalysisData[];
    }

    let shopeeReturns: ShopeeReturnData[] = [];
    const shopeeQuery = await untypedSupabase
      .from('shopee_returns')
      .select('*')
      .gte('order_date', startDate)
      .lt('order_date', endDate);

    if (!shopeeQuery.error && shopeeQuery.data) {
      shopeeReturns = shopeeQuery.data as ShopeeReturnData[];
    } else if (shopeeQuery.error) {
      console.warn('Shopee returns query error:', shopeeQuery.error.message);
    }

    let pickupRecords: PickupRecordData[] = [];
    const pickupQuery = await untypedSupabase
      .from('pickup_records')
      .select('*')
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (!pickupQuery.error && pickupQuery.data) {
      pickupRecords = pickupQuery.data as PickupRecordData[];
    } else if (pickupQuery.error) {
      console.warn('Pickup records query error:', pickupQuery.error.message);
    }

    const totalDataCount =
      returns.length + shopeeReturns.length + pickupRecords.length;
    if (totalDataCount === 0) {
      return NextResponse.json(
        { success: false, error: `${period} 沒有可分析的退貨資料` },
        { status: 404 }
      );
    }

    const totalReturns = returns.length + shopeeReturns.length;
    const returnRefundAmount = returns.reduce(
      (sum, item) => sum + (item.refund_amount || 0),
      0
    );
    const shopeeRefundAmount = shopeeReturns.reduce(
      (sum, item) => sum + (item.refund_amount || item.total_price || 0),
      0
    );
    const totalRefundAmount = returnRefundAmount + shopeeRefundAmount;

    const storeCreditCount = returns.filter(
      (item) => item.refund_type === 'store_credit'
    ).length;
    const storeCreditRate =
      returns.length > 0 ? (storeCreditCount / returns.length) * 100 : 0;

    const fallbackAnalysis = buildFallbackAnalysis({
      period,
      returns,
      shopeeReturns,
      pickupRecords,
      totalReturns,
      totalRefundAmount,
    });

    const prompt = buildAnalysisPrompt({
      period,
      returns,
      shopeeReturns,
      pickupRecords,
      totalDataCount,
    });

    let analysisResult: AnalysisResult = fallbackAnalysis;
    let aiResponse = JSON.stringify({
      fallback: true,
      reason: '本次使用系統統計分析',
    });
    let warning: string | undefined;

    if (!process.env.GEMINI_API_KEY) {
      warning = '未設定 Gemini API 金鑰，已改用系統統計分析。';
    } else {
      try {
        const rawResponse = await callGeminiAPI(prompt);

        if (!rawResponse) {
          throw new Error('AI 回傳空白內容');
        }

        aiResponse = rawResponse
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const parsed = JSON.parse(aiResponse) as Partial<AnalysisResult>;
        analysisResult = normalizeAnalysisResult(parsed, fallbackAnalysis);
      } catch (error) {
        console.error('AI analysis fallback triggered:', error);
        const errorMessage =
          error instanceof Error ? error.message : '未知 AI 錯誤';
        const isQuotaError =
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('429') ||
          errorMessage.includes('spending cap');

        warning = isQuotaError
          ? 'Gemini 本月配額已用盡，已改用系統統計分析。'
          : 'AI 模型暫時無法使用，已改用系統統計分析。';
        aiResponse = JSON.stringify(
          {
            fallback: true,
            reason: errorMessage,
          },
          null,
          2
        );
      }
    }

    const reportData = {
      report_period: period,
      report_type: 'monthly',
      pain_points: analysisResult.pain_points,
      recommendations: analysisResult.recommendations,
      sku_analysis: analysisResult.sku_analysis,
      channel_analysis: analysisResult.channel_analysis,
      trend_analysis: { summary: analysisResult.summary },
      raw_prompt: prompt,
      raw_response: aiResponse,
      total_returns: totalReturns,
      total_refund_amount: totalRefundAmount,
      store_credit_rate: storeCreditRate,
    };

    const { data: report, error: saveError } = (await untypedSupabase
      .from('ai_analysis_reports')
      .insert(reportData)
      .select('id')
      .single()) as { data: { id: string } | null; error: Error | null };

    const saved = !saveError;
    if (saveError) {
      console.error('Save report error:', saveError);
    }

    return NextResponse.json({
      success: true,
      saved,
      warning:
        warning ??
        (saved ? undefined : '分析完成，但報告寫入資料庫失敗。'),
      data: {
        id: report?.id,
        period,
        summary: analysisResult.summary,
        painPoints: analysisResult.pain_points,
        recommendations: analysisResult.recommendations,
        skuAnalysis: analysisResult.sku_analysis,
        channelAnalysis: analysisResult.channel_analysis,
        statistics: {
          totalReturns,
          totalRefundAmount,
          storeCreditRate,
          returnRequestsCount: returns.length,
          shopeeReturnsCount: shopeeReturns.length,
          pickupRecordsCount: pickupRecords.length,
        },
      },
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    return NextResponse.json(
      { success: false, error: `分析失敗：${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await isAuthenticatedRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '未登入或登入已失效' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const limit = searchParams.get('limit');

    const supabase = createAdminClient();

    let query = supabase
      .from('ai_analysis_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (period) {
      query = query.eq('report_period', period);
    }

    const queryLimit = limit ? parseInt(limit, 10) : 50;
    const { data, error } = await query.limit(queryLimit);

    if (error) {
      console.error('Fetch reports error:', error);
      return NextResponse.json(
        { success: false, error: '取得分析報告失敗' },
        { status: 500 }
      );
    }

    const normalizedData = (data || []).map((report) =>
      normalizeLegacyReportStatistics(report as unknown as Record<string, unknown>)
    );

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { success: false, error: '取得分析報告失敗' },
      { status: 500 }
    );
  }
}
