import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { utils, write } from 'xlsx';
import { RETURN_STATUS_LABELS, CHANNEL_LIST, RETURN_REASONS, RETURN_SHIPPING_METHODS, REFUND_TYPES } from '@/config/constants';

interface ReturnExportData {
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  return_shipping_method: string | null;
  tracking_number: string | null;
  refund_type: string;
  refund_amount: number | null;
  applied_at: string;
  approved_at: string | null;
  received_at: string | null;
  inspected_at: string | null;
  closed_at: string | null;
  review_notes: string | null;
  inspection_notes: string | null;
  order?: {
    order_number: string;
    customer_name: string | null;
    customer_phone: string;
  } | null;
  return_items?: {
    product_name: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const supabase = createAdminClient();

    let query = supabase
      .from('return_requests')
      .select(`
        *,
        order:orders (
          order_number,
          customer_name,
          customer_phone,
          channel_source,
          total_amount
        ),
        return_items (
          product_name,
          sku,
          quantity,
          unit_price
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (channel) {
      query = query.eq('channel_source', channel);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Export error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    // Transform data for Excel
    const excelData = (data as ReturnExportData[] | null)?.map((r) => {
      const channel = CHANNEL_LIST.find((c) => c.key === r.channel_source)?.label || r.channel_source || '';
      const reason = Object.values(RETURN_REASONS).find((re) => re.key === r.reason_category)?.label || r.reason_category || '';
      const shippingMethod = Object.values(RETURN_SHIPPING_METHODS).find((m) => m.key === r.return_shipping_method)?.label || '';
      const refundType = Object.values(REFUND_TYPES).find((t) => t.key === r.refund_type)?.label || '';
      const products = r.return_items?.map((item: { product_name: string }) => item.product_name).join(', ') || '';

      return {
        '退貨單號': r.request_number,
        '訂單編號': r.order?.order_number || '',
        '客戶名稱': r.order?.customer_name || '',
        '客戶電話': r.order?.customer_phone || '',
        '通路來源': channel,
        '狀態': RETURN_STATUS_LABELS[r.status] || r.status,
        '退貨原因': reason,
        '詳細說明': r.reason_detail || '',
        '退回方式': shippingMethod,
        '物流單號': r.tracking_number || '',
        '退款方式': refundType,
        '退款金額': r.refund_amount || 0,
        '退貨商品': products,
        '申請時間': r.applied_at,
        '審核時間': r.approved_at || '',
        '收貨時間': r.received_at || '',
        '驗貨時間': r.inspected_at || '',
        '結案時間': r.closed_at || '',
        '審核備註': r.review_notes || '',
        '驗貨備註': r.inspection_notes || '',
      };
    }) || [];

    // Create workbook
    const wb = utils.book_new();
    const ws = utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 18 }, // 退貨單號
      { wch: 18 }, // 訂單編號
      { wch: 15 }, // 客戶名稱
      { wch: 12 }, // 客戶電話
      { wch: 10 }, // 通路來源
      { wch: 12 }, // 狀態
      { wch: 12 }, // 退貨原因
      { wch: 30 }, // 詳細說明
      { wch: 12 }, // 退回方式
      { wch: 15 }, // 物流單號
      { wch: 10 }, // 退款方式
      { wch: 10 }, // 退款金額
      { wch: 40 }, // 退貨商品
      { wch: 18 }, // 申請時間
      { wch: 18 }, // 審核時間
      { wch: 18 }, // 收貨時間
      { wch: 18 }, // 驗貨時間
      { wch: 18 }, // 結案時間
      { wch: 30 }, // 審核備註
      { wch: 30 }, // 驗貨備註
    ];

    utils.book_append_sheet(wb, ws, '退貨單');

    // Generate buffer
    const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return as file download
    const filename = `退貨單匯出_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}
