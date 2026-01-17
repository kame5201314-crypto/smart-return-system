import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';
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

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('退貨單');

    // Define columns with headers and widths
    worksheet.columns = [
      { header: '退貨單號', key: 'request_number', width: 18 },
      { header: '訂單編號', key: 'order_number', width: 18 },
      { header: '客戶名稱', key: 'customer_name', width: 15 },
      { header: '客戶電話', key: 'customer_phone', width: 12 },
      { header: '通路來源', key: 'channel', width: 10 },
      { header: '狀態', key: 'status', width: 12 },
      { header: '退貨原因', key: 'reason', width: 12 },
      { header: '詳細說明', key: 'reason_detail', width: 30 },
      { header: '退回方式', key: 'shipping_method', width: 12 },
      { header: '物流單號', key: 'tracking_number', width: 15 },
      { header: '退款方式', key: 'refund_type', width: 10 },
      { header: '退款金額', key: 'refund_amount', width: 10 },
      { header: '退貨商品', key: 'products', width: 40 },
      { header: '申請時間', key: 'applied_at', width: 18 },
      { header: '審核時間', key: 'approved_at', width: 18 },
      { header: '收貨時間', key: 'received_at', width: 18 },
      { header: '驗貨時間', key: 'inspected_at', width: 18 },
      { header: '結案時間', key: 'closed_at', width: 18 },
      { header: '審核備註', key: 'review_notes', width: 30 },
      { header: '驗貨備註', key: 'inspection_notes', width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    // Add data rows
    (data as ReturnExportData[] | null)?.forEach((r) => {
      const channelLabel = CHANNEL_LIST.find((c) => c.key === r.channel_source)?.label || r.channel_source || '';
      const reasonLabel = Object.values(RETURN_REASONS).find((re) => re.key === r.reason_category)?.label || r.reason_category || '';
      const shippingMethodLabel = Object.values(RETURN_SHIPPING_METHODS).find((m) => m.key === r.return_shipping_method)?.label || '';
      const refundTypeLabel = Object.values(REFUND_TYPES).find((t) => t.key === r.refund_type)?.label || '';
      const products = r.return_items?.map((item: { product_name: string }) => item.product_name).join(', ') || '';

      worksheet.addRow({
        request_number: r.request_number,
        order_number: r.order?.order_number || '',
        customer_name: r.order?.customer_name || '',
        customer_phone: r.order?.customer_phone || '',
        channel: channelLabel,
        status: RETURN_STATUS_LABELS[r.status] || r.status,
        reason: reasonLabel,
        reason_detail: r.reason_detail || '',
        shipping_method: shippingMethodLabel,
        tracking_number: r.tracking_number || '',
        refund_type: refundTypeLabel,
        refund_amount: r.refund_amount || 0,
        products: products,
        applied_at: r.applied_at,
        approved_at: r.approved_at || '',
        received_at: r.received_at || '',
        inspected_at: r.inspected_at || '',
        closed_at: r.closed_at || '',
        review_notes: r.review_notes || '',
        inspection_notes: r.inspection_notes || '',
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

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
