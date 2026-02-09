import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireRouteAuth } from '@/lib/auth/route-auth';

interface ReturnAnalysisData {
  request_number: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  refund_amount: number | null;
  refund_type: string | null;
  return_items?: {
    product_name: string;
    sku: string;
    reason: string;
  }[];
  inspection_records?: {
    result: string | null;
    condition_grade: string | null;
    inspector_comment: string | null;
  }[];
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period);
}

function parseLimit(limitRaw: string | null): number {
  if (!limitRaw) return 50;
  const parsed = Number.parseInt(limitRaw, 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 200);
}

async function listAvailableModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!response.ok) {
    console.error('Failed to list Gemini models:', response.status);
    return [];
  }

  const data = await response.json();
  return data.models?.map((m: { name: string }) => m.name) || [];
}

async function callGeminiAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
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
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error('Gemini API request failed:', {
      status: response.status,
      modelToUse,
      availableModels,
      body,
    });
    throw new Error('GEMINI_REQUEST_FAILED');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRouteAuth({ requireAdmin: true });
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const period = String(body?.period || '').trim();

    if (!isValidPeriod(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period format. Use YYYY-MM.' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'AI service is not configured' },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    const startDate = `${period}-01`;
    const endDate = format(
      new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
      'yyyy-MM-dd'
    );

    let returns: ReturnAnalysisData[] | null = null;

    const fullQuery = await supabase
      .from('return_requests')
      .select(`
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
      `)
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (fullQuery.error) {
      console.warn('Full relation query failed, fallback to base query:', fullQuery.error.message);
      const basicQuery = await supabase
        .from('return_requests')
        .select('*')
        .gte('created_at', startDate)
        .lt('created_at', endDate);

      if (basicQuery.error) {
        console.error('Return query failed:', basicQuery.error);
        return NextResponse.json(
          { success: false, error: 'Failed to load return data' },
          { status: 500 }
        );
      }

      returns = basicQuery.data as ReturnAnalysisData[];
    } else {
      returns = fullQuery.data as ReturnAnalysisData[];
    }

    if (!returns || returns.length === 0) {
      return NextResponse.json(
        { success: false, error: `No return data for ${period}` },
        { status: 404 }
      );
    }

    const analysisData = returns.map((r) => ({
      request_number: r.request_number,
      channel: r.channel_source,
      reason_category: r.reason_category,
      reason_detail: r.reason_detail,
      refund_amount: r.refund_amount,
      products: r.return_items?.map((item) => ({
        name: item.product_name,
        sku: item.sku,
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

    const prompt = `Analyze the following return data for period ${period} and output STRICT JSON only.

Data:
${JSON.stringify(analysisData, null, 2)}

Expected JSON format:
{
  "summary": "short summary",
  "pain_points": [{"issue":"","frequency":"high|medium|low","impact":"high|medium|low","affected_products":[]}],
  "recommendations": [{"title":"","description":"","priority":"high|medium|low","category":"product|logistics|customer_service|marketing"}],
  "sku_analysis": [{"sku":"","product_name":"","return_count":0,"return_rate":"","main_issues":[],"suggestion":""}],
  "channel_analysis": [{"channel":"","return_count":0,"common_issues":[]}]
}`;

    let aiResponse = await callGeminiAPI(prompt);
    if (!aiResponse) {
      return NextResponse.json(
        { success: false, error: 'AI analysis failed' },
        { status: 500 }
      );
    }

    aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let analysisResult: {
      summary?: string;
      pain_points?: unknown;
      recommendations?: unknown;
      sku_analysis?: unknown;
      channel_analysis?: unknown;
    };

    try {
      analysisResult = JSON.parse(aiResponse);
    } catch {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const totalReturns = returns.length;
    const totalRefundAmount = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
    const storeCreditCount = returns.filter((r) => r.refund_type === 'store_credit').length;
    const storeCreditRate = totalReturns > 0 ? (storeCreditCount / totalReturns) * 100 : 0;

    const reportData = {
      report_period: period,
      report_type: 'monthly',
      pain_points: analysisResult.pain_points || [],
      recommendations: analysisResult.recommendations || [],
      sku_analysis: analysisResult.sku_analysis || [],
      channel_analysis: analysisResult.channel_analysis || [],
      trend_analysis: { summary: analysisResult.summary || '' },
      raw_prompt: prompt,
      raw_response: aiResponse,
      total_returns: totalReturns,
      total_refund_amount: totalRefundAmount,
      store_credit_rate: storeCreditRate,
    };

    const { data: report, error: saveError } = await supabase
      .from('ai_analysis_reports')
      .insert(reportData as never)
      .select()
      .single() as { data: { id: string } | null; error: Error | null };

    if (saveError) {
      console.error('Save report error:', saveError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: report?.id,
        period,
        summary: analysisResult.summary || '',
        painPoints: analysisResult.pain_points || [],
        recommendations: analysisResult.recommendations || [],
        skuAnalysis: analysisResult.sku_analysis || [],
        channelAnalysis: analysisResult.channel_analysis || [],
        statistics: {
          totalReturns,
          totalRefundAmount,
          storeCreditRate,
        },
      },
    });
  } catch (error) {
    console.error('AI analysis route error:', error);
    return NextResponse.json(
      { success: false, error: 'AI analysis failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteAuth({ requireAdmin: true });
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const queryLimit = parseLimit(searchParams.get('limit'));

    if (period && !isValidPeriod(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period format. Use YYYY-MM.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let query = supabase
      .from('ai_analysis_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (period) {
      query = query.eq('report_period', period);
    }

    const { data, error } = await query.limit(queryLimit);

    if (error) {
      console.error('Fetch reports error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get reports' },
      { status: 500 }
    );
  }
}