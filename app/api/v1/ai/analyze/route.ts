import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createUntypedAdminClient } from '@/lib/supabase/admin';
import { isAuthenticatedRequest } from '@/lib/auth/request-auth';
import { format } from 'date-fns';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import { normalizeResolutionTypeFromFallback } from '@/lib/utils/resolution-fallback';
import { containsLikelyMojibake } from '@/lib/utils/text-hygiene';
import { buildReconcileMismatches } from '@/lib/maintenance/reconcile-ai-reports';
import {
  buildAISkuAnalysisGroups,
  type AISkuAnalysisGroupInput,
  normalizeAISkuAnalysisOutput,
} from '@/lib/utils/ai-sku-analysis';
import {
  buildAIAnalysisDatasetFingerprint,
  buildAIAnalysisPromptPayload,
  buildAIAnalysisPromptStorageSnapshot,
  buildAIAnalysisResponseSnapshot,
  buildTextOnlyAIAnalysisPrompt,
} from '@/lib/utils/ai-analysis-prompt';
import {
  buildAIJsonRepairPrompt,
  parseAIAnalysisResponseText,
} from '@/lib/utils/ai-analysis-response';
import { buildLocalAIAnalysisFallback } from '@/lib/utils/ai-analysis-fallback';
import { isShopeeReturnInReportPeriod } from '@/lib/utils/return-period';

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
  dispute_deadline: string | null;
  processed_at: string | null;
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

function parseStoredJsonObject(rawValue: unknown): Record<string, unknown> | null {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue as Record<string, unknown>;
  }

  if (typeof rawValue !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function extractPromptFingerprint(rawPrompt: unknown): string | null {
  const snapshot = parseStoredJsonObject(rawPrompt);
  const fingerprint = snapshot?.payload_fingerprint;
  return typeof fingerprint === 'string' && fingerprint.trim() ? fingerprint : null;
}

function buildStoredReportResponse(
  report: Record<string, unknown>,
  candidates: AISkuAnalysisGroupInput[]
) {
  const normalizedStats = normalizeLegacyReportStatistics(report);
  const promptSnapshot = parseStoredJsonObject(report.raw_prompt);
  const responseSnapshot = parseStoredJsonObject(report.raw_response);
  const datasetCounts = parseStoredJsonObject(promptSnapshot?.dataset_counts);

  return {
    id: typeof report.id === 'string' ? report.id : undefined,
    period:
      typeof report.report_period === 'string' && report.report_period
        ? report.report_period
        : '',
    summary:
      (report.trend_analysis as { summary?: string } | null)?.summary
      || '',
    painPoints: Array.isArray(report.pain_points) ? report.pain_points : [],
    recommendations: Array.isArray(report.recommendations) ? report.recommendations : [],
    skuAnalysis: normalizeAISkuAnalysisOutput(
      normalizeSkuAnalysis(report.sku_analysis, candidates)
    ),
    channelAnalysis: Array.isArray(report.channel_analysis) ? report.channel_analysis : [],
    statistics: {
      totalReturns: toNumberOrNull(normalizedStats.total_returns) ?? 0,
      totalRefundAmount: toNumberOrNull(normalizedStats.total_refund_amount) ?? 0,
      storeCreditRate: toNumberOrNull(normalizedStats.store_credit_rate) ?? 0,
      returnRequestsCount: toNumberOrNull(datasetCounts?.official_returns) ?? 0,
      shopeeReturnsCount: toNumberOrNull(datasetCounts?.shopee_returns) ?? 0,
      pickupRecordsCount: toNumberOrNull(datasetCounts?.pickup_records) ?? 0,
    },
    diagnostics: {
      model:
        typeof responseSnapshot?.model === 'string' ? responseSnapshot.model : null,
      promptCharacterCount:
        toNumberOrNull(promptSnapshot?.prompt_character_count) ?? null,
      usageMetadata:
        responseSnapshot?.usage_metadata && typeof responseSnapshot.usage_metadata === 'object'
          ? (responseSnapshot.usage_metadata as Record<string, unknown>)
          : null,
    },
  };
}

const GEMINI_TEXT_MODELS = [
  process.env.GEMINI_TEXT_MODEL?.replace(/\\n/g, '').trim(),
  'models/gemini-2.0-flash-lite',
  'models/gemini-2.0-flash',
  'models/gemini-flash-latest',
].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
const GEMINI_MAX_OUTPUT_TOKENS = (() => {
  const rawValue = Number.parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '1200', 10);
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 1200;
})();

interface GeminiTextResponse {
  text: string;
  model: string;
  usageMetadata: Record<string, unknown> | null;
}

interface AIAnalysisResponsePayload {
  summary: string;
  pain_points: unknown[];
  recommendations: unknown[];
  sku_analysis: unknown[];
  channel_analysis: unknown[];
}

// Direct REST API call for Gemini
async function callGeminiAPI(
  prompt: string,
  apiKey: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    modelCandidates?: string[];
  }
): Promise<GeminiTextResponse> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let lastError = 'Unknown Gemini API error';
  const modelCandidates = options?.modelCandidates || GEMINI_TEXT_MODELS;

  for (const modelToUse of modelCandidates) {
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
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS,
            ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
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

async function repairAIResponseJson(
  rawResponse: string,
  apiKey: string
): Promise<GeminiTextResponse> {
  return callGeminiAPI(buildAIJsonRepairPrompt(rawResponse), apiKey, {
    temperature: 0,
    maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    responseMimeType: 'application/json',
    modelCandidates: GEMINI_TEXT_MODELS,
  });
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
    // Shopee analytics use the customer order date first so Data Center and AI reports
    // count the same month as the order list.
    let shopeeReturns: ShopeeReturnData[] = [];
    const shopeeQuery = await untypedSupabase
      .from('shopee_returns')
      .select('*');

    if (!shopeeQuery.error && shopeeQuery.data) {
      shopeeReturns = (shopeeQuery.data as ShopeeReturnData[]).filter((row) =>
        isShopeeReturnInReportPeriod(row, period)
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
        { success: false, error: `${period} 沒有可分析的退貨資料` },
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
    const payloadFingerprint = buildAIAnalysisDatasetFingerprint(promptPayload);
    const prompt = buildTextOnlyAIAnalysisPrompt(promptPayload);

    // Call Gemini API using direct REST API (more reliable)
    const promptStorageSnapshot = buildAIAnalysisPromptStorageSnapshot({
      period,
      prompt,
      payload: promptPayload,
      modelCandidates: GEMINI_TEXT_MODELS,
    });

    const { data: existingReport, error: existingReportError } = await untypedSupabase
      .from('ai_analysis_reports')
      .select('*')
      .eq('report_period', period)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as {
        data: Record<string, unknown> | null;
        error: Error | null;
      };

    if (existingReportError) {
      console.warn('Existing AI report query error:', existingReportError.message);
    }

    if (existingReport && extractPromptFingerprint(existingReport.raw_prompt) === payloadFingerprint) {
      return NextResponse.json({
        success: true,
        saved: true,
        reused: true,
        message: '已使用既有分析報告',
        data: buildStoredReportResponse(existingReport, skuGroupAnalysisData),
      });
    }

    let aiResult: GeminiTextResponse;
    let aiResponse: string;
    let analysisResult: AIAnalysisResponsePayload;
    try {
      aiResult = await callGeminiAPI(prompt, geminiApiKey, {
        responseMimeType: 'application/json',
      });
      aiResponse = aiResult.text;

      if (!aiResponse) {
        throw new Error('Gemini returned an empty response');
      }

      try {
        analysisResult = parseAIAnalysisResponseText(aiResponse) as unknown as AIAnalysisResponsePayload;
      } catch (parseError) {
        console.warn('Primary AI response parse failed, attempting JSON repair:', parseError);

        const repairedResult = await repairAIResponseJson(aiResponse, geminiApiKey);
        aiResult = {
          text: repairedResult.text,
          model: `${aiResult.model} -> ${repairedResult.model}`,
          usageMetadata: {
            primary: aiResult.usageMetadata,
            repair: repairedResult.usageMetadata,
          },
        };
        aiResponse = repairedResult.text;
        analysisResult = parseAIAnalysisResponseText(aiResponse) as unknown as AIAnalysisResponsePayload;
      }
    } catch (aiError) {
      const fallbackReason = getErrorMessage(aiError) || 'Unknown AI provider failure';
      console.warn('AI provider unavailable, using local text-only fallback:', fallbackReason);

      analysisResult = buildLocalAIAnalysisFallback(promptPayload);
      aiResponse = JSON.stringify(analysisResult);
      aiResult = {
        text: aiResponse,
        model: 'local-text-fallback',
        usageMetadata: {
          fallback: true,
          reason: fallbackReason.slice(0, 500),
        },
      };
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
        { success: false, error: 'AI 回應內容疑似亂碼，請重新分析' },
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

    const normalizedData: Record<string, unknown>[] = (data || []).map((report) => {
      const rawReport = report as unknown as Record<string, unknown>;
      const normalizedStats = normalizeLegacyReportStatistics(rawReport);

      return {
        ...rawReport,
        ...normalizedStats,
        sku_analysis: normalizeAISkuAnalysisOutput(rawReport.sku_analysis),
      };
    });

    if (period && normalizedData.length > 0) {
      const untypedSupabase = createUntypedAdminClient();
      const startDate = `${period}-01`;
      const endDate = format(
        new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
        'yyyy-MM-dd'
      );

      const [returnRequestResult, shopeeReturnResult] = await Promise.all([
        untypedSupabase
          .from('return_requests')
          .select('created_at, refund_amount')
          .gte('created_at', startDate)
          .lt('created_at', endDate),
        untypedSupabase
          .from('shopee_returns')
          .select('order_date, dispute_deadline, processed_at, created_at, refund_amount, total_price'),
      ]);

      if (!returnRequestResult.error && !shopeeReturnResult.error) {
        const consistencySummary = buildReconcileMismatches({
          returnRequests: returnRequestResult.data || [],
          shopeeReturns: shopeeReturnResult.data || [],
          reports: normalizedData.map((report) => ({
            id: String(report.id || ''),
            report_period: String(report.report_period || ''),
            total_returns: Number(report.total_returns || 0),
            total_refund_amount: Number(report.total_refund_amount || 0),
            created_at: String(report.created_at || ''),
          })),
          compareAmount: false,
          periodFilter: new Set([period]),
        });

        const mismatch = consistencySummary.mismatches.find((item) => item.period === period);
        if (mismatch) {
          normalizedData[0] = {
            ...normalizedData[0],
            is_stale: true,
            expected_total_returns: mismatch.expectedReturns,
            actual_total_returns: mismatch.actualReturns,
          };
        }
      } else {
        console.warn(
          'AI report freshness check skipped:',
          returnRequestResult.error?.message || shopeeReturnResult.error?.message
        );
      }
    }

    return NextResponse.json({ success: true, data: normalizedData });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get reports' },
      { status: 500 }
    );
  }
}
