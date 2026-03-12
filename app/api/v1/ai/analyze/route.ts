import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createUntypedAdminClient } from '@/lib/supabase/admin';
import { isAuthenticatedRequest } from '@/lib/auth/request-auth';
import { format } from 'date-fns';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import { normalizeResolutionTypeFromFallback } from '@/lib/utils/resolution-fallback';
import { containsLikelyMojibake } from '@/lib/utils/text-hygiene';
import {
  buildAISkuAnalysisGroups,
  type AISkuAnalysisGroupInput,
  normalizeAISkuAnalysisOutput,
} from '@/lib/utils/ai-sku-analysis';
import {
  buildAIAnalysisPromptPayload,
  buildAIAnalysisPromptStorageSnapshot,
  buildAIAnalysisResponseSnapshot,
  buildTextOnlyAIAnalysisPrompt,
} from '@/lib/utils/ai-analysis-prompt';

interface ReturnAnalysisData {
  request_number: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  refund_amount: number | null;
  refund_type: string;
  refund_method?: string | null;
  return_items?: {
    product_name: string;
    sku: string;
    quantity: number;
    reason: string;
    resolution_type?: string | null;
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
  return_reason_note: string | null;
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

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

function isMissingColumnError(error: unknown, table: string, column: string): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;

  return (
    message.includes(`column ${table}.${column} does not exist`)
    || message.includes(`column ${table}_1.${column} does not exist`)
    || message.includes(`column ${table}_2.${column} does not exist`)
  );
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

function parseExcelDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) {
    return null;
  }

  // Excel serial date (Windows): days since 1899-12-30
  if (serial < 1 || serial > 100000) {
    return null;
  }

  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.floor(serial) * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

function extractYearMonthFromRaw(raw: string): string | null {
  // Covers formats like:
  // 2026-02-05, 2026/2/5, 2026年2月5日, 2026-02-05T00:00:00+08:00
  const match = raw.match(/(\d{4})\D+(\d{1,2})/);
  if (!match) {
    return null;
  }

  const year = match[1];
  const monthNum = Number(match[2]);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }

  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

function toYearMonth(dateValue: string | null | undefined): string | null {
  if (!dateValue) {
    return null;
  }

  const raw = String(dateValue).trim();
  if (!raw) {
    return null;
  }

  // Numeric text can be an Excel serial date.
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const excelDate = parseExcelDate(Number(raw));
    if (excelDate && !Number.isNaN(excelDate.getTime())) {
      const year = excelDate.getUTCFullYear();
      const month = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  }

  // Prefer raw text extraction first to avoid timezone shifting issues.
  const rawYearMonth = extractYearMonthFromRaw(raw);
  if (rawYearMonth) {
    return rawYearMonth;
  }

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    // Use UTC to keep server timezone from changing month boundaries.
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}

function isInPeriod(dateValue: string | null | undefined, period: string): boolean {
  return toYearMonth(dateValue) === period;
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

function normalizeSkuAnalysis(
  rawValue: unknown,
  candidates: AISkuAnalysisGroupInput[]
) {
  return normalizeAISkuAnalysisOutput(rawValue, candidates);
}

function extractFirstJsonObject(text: string): string {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  // Try direct parse first.
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // continue
  }

  // Fallback: extract first balanced JSON object.
  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in AI response');
  }

  let depth = 0;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      const candidate = cleaned.slice(start, i + 1);
      JSON.parse(candidate);
      return candidate;
    }
  }

  throw new Error('Incomplete JSON object in AI response');
}

const GEMINI_TEXT_MODELS = [
  process.env.GEMINI_TEXT_MODEL?.replace(/\\n/g, '').trim(),
  'models/gemini-2.0-flash-lite',
  'models/gemini-2.0-flash',
  'models/gemini-flash-latest',
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

interface GeminiTextResponse {
  text: string;
  model: string;
  usageMetadata: Record<string, unknown> | null;
}

// Direct REST API call for Gemini
async function callGeminiAPI(prompt: string, apiKey: string): Promise<GeminiTextResponse> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let lastError = 'Unknown Gemini API error';

  for (const modelToUse of GEMINI_TEXT_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1800,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        model: modelToUse,
        usageMetadata:
          data.usageMetadata && typeof data.usageMetadata === 'object'
            ? (data.usageMetadata as Record<string, unknown>)
            : null,
      };
    }

    const errorText = await response.text();
    lastError = `Gemini API error (model: ${modelToUse}): ${response.status} - ${errorText}`;

    if (response.status !== 404) {
      break;
    }
  }

  throw new Error(lastError);
}

export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await isAuthenticatedRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { period } = body; // e.g., '2024-01'

    if (!period) {
      return NextResponse.json(
        { success: false, error: 'Missing period parameter' },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY?.replace(/\\n/g, '').trim();

    // Check for Gemini API key
    if (!geminiApiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    const untypedSupabase = createUntypedAdminClient();

    // Get date range for the period
    const startDate = `${period}-01`;
    const endDate = format(
      new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
      'yyyy-MM-dd'
    );

    // ============ 1. Fetch return_requests ============
    let returns: ReturnAnalysisData[] = [];
    const queryWithResolution = await supabase
      .from('return_requests')
      .select(`
        *,
        return_items (
          product_name,
          sku:product_sku,
          quantity,
          reason,
          resolution_type
        ),
        inspection_records (
          result,
          condition_grade,
          inspector_comment
        )
      `)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (!queryWithResolution.error) {
      returns = queryWithResolution.data as ReturnAnalysisData[];
    } else if (isMissingColumnError(queryWithResolution.error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'api.ai.analyze.queryReturnRequests',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: queryWithResolution.error.message,
        context: { period },
      });
      const queryWithoutResolution = await supabase
        .from('return_requests')
        .select(`
          *,
          return_items (
            product_name,
            sku:product_sku,
            quantity,
            reason
          ),
          inspection_records (
            result,
            condition_grade,
            inspector_comment
          )
        `)
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (!queryWithoutResolution.error) {
        returns = (queryWithoutResolution.data as ReturnAnalysisData[]).map((row) => ({
          ...row,
          return_items: (row.return_items || []).map((item) => ({
            ...item,
            resolution_type: item.resolution_type || normalizeResolutionTypeFromFallback(row.refund_method),
          })),
        }));
      } else {
        console.warn('Fallback return query failed, trying basic query:', queryWithoutResolution.error.message);
        const basicQuery = await supabase
          .from('return_requests')
          .select('*')
          .gte('created_at', startDate)
          .lt('created_at', endDate);

        if (!basicQuery.error) {
          returns = basicQuery.data as ReturnAnalysisData[];
        }
      }
    } else {
      console.warn('Full query failed, trying basic query:', queryWithResolution.error.message);
      const basicQuery = await supabase
        .from('return_requests')
        .select('*')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (!basicQuery.error) {
        returns = basicQuery.data as ReturnAnalysisData[];
      }
    }

    // ============ 2. Fetch shopee_returns ============
    // Keep the same filtering behavior as Analytics page:
    // filter by order_date using JS date parsing to avoid DB type/format mismatch.
    let shopeeReturns: ShopeeReturnData[] = [];
    const shopeeQuery = await untypedSupabase
      .from('shopee_returns')
      .select('*');

    if (!shopeeQuery.error && shopeeQuery.data) {
      shopeeReturns = (shopeeQuery.data as ShopeeReturnData[]).filter((row) =>
        isInPeriod(row.order_date, period)
      );
    } else if (shopeeQuery.error) {
      console.warn('Shopee returns query error:', shopeeQuery.error.message);
    }

    // ============ 3. Fetch pickup_records ============
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

    // Check if we have any data at all
    const totalDataCount = returns.length + shopeeReturns.length + pickupRecords.length;
    if (totalDataCount === 0) {
      return NextResponse.json(
        { success: false, error: `${period} 月份沒有任何資料可分析` },
        { status: 404 }
      );
    }

    // ============ Prepare token-lean text summary for AI analysis ============
    const skuGroupAnalysisData = buildAISkuAnalysisGroups([
      ...returns.flatMap((r) =>
        (r.return_items || []).map((item) => ({
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          channel: r.channel_source,
          reasonTexts: [r.reason_category, r.reason_detail, item.reason],
        }))
      ),
      ...shopeeReturns.map((r) => ({
        productName: r.product_name,
        sku: r.option_sku,
        quantity: r.return_quantity,
        channel: r.platform === 'mall' ? 'mall' : 'shopee',
        reasonTexts: [r.return_reason],
        buyerNoteTexts: [r.buyer_note],
        returnReasonNoteTexts: [r.return_reason_note],
      })),
    ]);

    const promptPayload = buildAIAnalysisPromptPayload({
      period,
      returns,
      shopeeReturns,
      pickupRecords,
      skuGroups: skuGroupAnalysisData,
    });
    const prompt = buildTextOnlyAIAnalysisPrompt(promptPayload);

    // Call Gemini API using direct REST API (more reliable)
    const promptStorageSnapshot = buildAIAnalysisPromptStorageSnapshot({
      period,
      prompt,
      payload: promptPayload,
      modelCandidates: GEMINI_TEXT_MODELS,
    });

    const aiResult = await callGeminiAPI(prompt, geminiApiKey);
    let aiResponse = aiResult.text;

    if (!aiResponse) {
      return NextResponse.json(
        { success: false, error: 'AI analysis failed' },
        { status: 500 }
      );
    }

    // Parse AI response
    let analysisResult;
    try {
      const jsonText = extractFirstJsonObject(aiResponse);
      analysisResult = JSON.parse(jsonText);
      aiResponse = jsonText;
    } catch {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    analysisResult = {
      ...analysisResult,
      sku_analysis: normalizeAISkuAnalysisOutput(
        normalizeSkuAnalysis(analysisResult?.sku_analysis, skuGroupAnalysisData)
      ),
    };

    if (containsLikelyMojibake(analysisResult)) {
      console.error('AI response appears to contain mojibake-like content:', aiResponse);
      return NextResponse.json(
        { success: false, error: 'AI 回傳內容疑似亂碼，請重新分析一次' },
        { status: 502 }
      );
    }

    // Calculate statistics (combining all data sources)
    const totalReturns = returns.length + shopeeReturns.length;
    const returnRefundAmount = returns.reduce(
      (sum, r) => sum + (r.refund_amount || 0), 0
    );
    const shopeeRefundAmount = shopeeReturns.reduce(
      (sum, r) => sum + (r.refund_amount || r.total_price || 0), 0
    );
    const totalRefundAmount = returnRefundAmount + shopeeRefundAmount;

    const storeCreditCount = returns.filter(
      (r) => r.refund_type === 'store_credit'
    ).length;
    const storeCreditRate =
      returns.length > 0 ? (storeCreditCount / returns.length) * 100 : 0;

    // Save report to database
    const reportData = {
      report_period: period,
      report_type: 'monthly',
      pain_points: analysisResult.pain_points,
      recommendations: analysisResult.recommendations,
      sku_analysis: analysisResult.sku_analysis,
      channel_analysis: analysisResult.channel_analysis,
      trend_analysis: { summary: analysisResult.summary },
      raw_prompt: JSON.stringify(promptStorageSnapshot),
      raw_response: JSON.stringify(
        buildAIAnalysisResponseSnapshot({
          model: aiResult.model,
          text: aiResponse,
          usageMetadata: aiResult.usageMetadata,
        })
      ),
      total_returns: totalReturns,
      total_refund_amount: totalRefundAmount,
      store_credit_rate: storeCreditRate,
    };
    const { data: report, error: saveError } = await untypedSupabase
      .from('ai_analysis_reports')
      .insert(reportData)
      .select('id')
      .single() as { data: { id: string } | null; error: Error | null };

    const saved = !saveError;
    if (saveError) {
      console.error('Save report error:', saveError);
      // Still return the analysis even if save fails
    }

    return NextResponse.json({
      success: true,
      saved,
      warning: saved ? undefined : '分析完成，但報告儲存失敗',
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
        diagnostics: {
          model: aiResult.model,
          promptCharacterCount: prompt.length,
          usageMetadata: aiResult.usageMetadata,
        },
      },
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 顯示完整錯誤訊息以便診斷
    return NextResponse.json(
      { success: false, error: `分析失敗: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Get existing reports
export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await isAuthenticatedRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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

    // Allow custom limit, default to 50 for history page
    const queryLimit = limit ? parseInt(limit, 10) : 50;
    const { data, error } = await query.limit(queryLimit);

    if (error) {
      console.error('Fetch reports error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    const normalizedData = (data || []).map((report) => {
      const rawReport = report as unknown as Record<string, unknown>;
      const normalizedStats = normalizeLegacyReportStatistics(rawReport);

      return {
        ...rawReport,
        ...normalizedStats,
        sku_analysis: normalizeAISkuAnalysisOutput(rawReport.sku_analysis),
      };
    });

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get reports' },
      { status: 500 }
    );
  }
}
