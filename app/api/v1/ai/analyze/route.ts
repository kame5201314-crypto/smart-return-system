import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';

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
    reason: string;
  }[];
  inspection_records?: {
    result: string | null;
    condition_grade: string | null;
    inspector_comment: string | null;
  }[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period } = body; // e.g., '2024-01'

    if (!period) {
      return NextResponse.json(
        { success: false, error: 'Missing period parameter' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get return requests for the period
    const startDate = `${period}-01`;
    const endDate = format(
      new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
      'yyyy-MM-dd'
    );

    const { data: returns, error: fetchError } = await supabase
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

    if (fetchError) {
      console.error('Fetch returns error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch return data' },
        { status: 500 }
      );
    }

    if (!returns || returns.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No return data found for this period' },
        { status: 404 }
      );
    }

    // Prepare data for AI analysis
    const analysisData = (returns as ReturnAnalysisData[]).map((r) => ({
      request_number: r.request_number,
      channel: r.channel_source,
      reason_category: r.reason_category,
      reason_detail: r.reason_detail,
      refund_amount: r.refund_amount,
      products: r.return_items?.map((item: { product_name: string; sku: string; reason: string }) => ({
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

    // Build prompt for AI
    const prompt = `你是一位專業的電商營運分析師。請分析以下 ${period} 月份的退貨數據，並提供可執行的商業洞察。

退貨數據：
${JSON.stringify(analysisData, null, 2)}

請以 JSON 格式回覆，包含以下部分：

{
  "summary": "一段簡短的總結 (100字以內)",
  "pain_points": [
    {
      "issue": "問題描述",
      "frequency": "出現頻率 (high/medium/low)",
      "impact": "影響程度 (high/medium/low)",
      "affected_products": ["受影響的產品列表"]
    }
  ],
  "recommendations": [
    {
      "title": "建議標題",
      "description": "詳細描述",
      "priority": "優先級 (high/medium/low)",
      "category": "類別 (product/logistics/customer_service/marketing)"
    }
  ],
  "sku_analysis": [
    {
      "sku": "SKU編號",
      "product_name": "產品名稱",
      "return_count": 數量,
      "main_issues": ["主要問題"],
      "suggestion": "改善建議"
    }
  ],
  "channel_analysis": [
    {
      "channel": "通路名稱",
      "return_count": 數量,
      "common_issues": ["常見問題"]
    }
  ]
}

請用繁體中文回覆，並確保建議具有可執行性。`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是專業的電商營運分析師，擅長從退貨數據中發現問題並提供可執行的改善建議。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      return NextResponse.json(
        { success: false, error: 'AI analysis failed' },
        { status: 500 }
      );
    }

    // Parse AI response
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiResponse);
    } catch {
      console.error('Failed to parse AI response:', aiResponse);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const typedReturns = returns as ReturnAnalysisData[];
    const totalReturns = typedReturns.length;
    const totalRefundAmount = typedReturns.reduce(
      (sum, r) => sum + (r.refund_amount || 0),
      0
    );
    const storeCreditCount = typedReturns.filter(
      (r) => r.refund_type === 'store_credit'
    ).length;
    const storeCreditRate =
      totalReturns > 0 ? (storeCreditCount / totalReturns) * 100 : 0;

    // Save report to database
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
    const { data: report, error: saveError } = await supabase
      .from('ai_analysis_reports')
      .insert(reportData as never)
      .select()
      .single() as { data: { id: string } | null; error: Error | null };

    if (saveError) {
      console.error('Save report error:', saveError);
      // Still return the analysis even if save fails
    }

    return NextResponse.json({
      success: true,
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
        },
      },
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Analysis failed' },
      { status: 500 }
    );
  }
}

// Get existing reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    const supabase = createAdminClient();

    let query = supabase
      .from('ai_analysis_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (period) {
      query = query.eq('report_period', period);
    }

    const { data, error } = await query.limit(10);

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
