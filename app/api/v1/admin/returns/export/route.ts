import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { createAdminClient } from '@/lib/supabase/admin';
import { RETURN_STATUS_LABELS, CHANNEL_LIST, RETURN_REASONS, RETURN_SHIPPING_METHODS, REFUND_TYPES } from '@/config/constants';
import { requireRouteAuth } from '@/lib/auth/route-auth';

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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateDateInput(value: string | null): boolean {
  if (!value) return true;
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
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
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!validateDateInput(dateFrom) || !validateDateInput(dateTo)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return NextResponse.json(
        { success: false, error: 'dateFrom cannot be later than dateTo' },
        { status: 400 }
      );
    }

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

    if (status) query = query.eq('status', status);
    if (channel) query = query.eq('channel_source', channel);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;

    if (error) {
      console.error('Export query error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('returns');

    worksheet.columns = [
      { header: 'request_number', key: 'request_number', width: 18 },
      { header: 'order_number', key: 'order_number', width: 18 },
      { header: 'customer_name', key: 'customer_name', width: 15 },
      { header: 'customer_phone', key: 'customer_phone', width: 14 },
      { header: 'channel', key: 'channel', width: 12 },
      { header: 'status', key: 'status', width: 16 },
      { header: 'reason', key: 'reason', width: 16 },
      { header: 'reason_detail', key: 'reason_detail', width: 30 },
      { header: 'shipping_method', key: 'shipping_method', width: 18 },
      { header: 'tracking_number', key: 'tracking_number', width: 18 },
      { header: 'refund_type', key: 'refund_type', width: 16 },
      { header: 'refund_amount', key: 'refund_amount', width: 12 },
      { header: 'products', key: 'products', width: 40 },
      { header: 'applied_at', key: 'applied_at', width: 20 },
      { header: 'approved_at', key: 'approved_at', width: 20 },
      { header: 'received_at', key: 'received_at', width: 20 },
      { header: 'inspected_at', key: 'inspected_at', width: 20 },
      { header: 'closed_at', key: 'closed_at', width: 20 },
      { header: 'review_notes', key: 'review_notes', width: 30 },
      { header: 'inspection_notes', key: 'inspection_notes', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };

    (data as ReturnExportData[] | null)?.forEach((r) => {
      const channelLabel = CHANNEL_LIST.find((c) => c.key === r.channel_source)?.label || r.channel_source || '';
      const reasonLabel = Object.values(RETURN_REASONS).find((re) => re.key === r.reason_category)?.label || r.reason_category || '';
      const shippingMethodLabel =
        Object.values(RETURN_SHIPPING_METHODS).find((m) => m.key === r.return_shipping_method)?.label || '';
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
        products,
        applied_at: r.applied_at,
        approved_at: r.approved_at || '',
        received_at: r.received_at || '',
        inspected_at: r.inspected_at || '',
        closed_at: r.closed_at || '',
        review_notes: r.review_notes || '',
        inspection_notes: r.inspection_notes || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `returns_export_${new Date().toISOString().split('T')[0]}.xlsx`;

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