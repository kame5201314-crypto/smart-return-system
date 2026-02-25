import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createUntypedAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';
import ExcelJS from 'exceljs';
import {
  RETURN_STATUS_LABELS,
  CHANNEL_LIST,
  RETURN_REASONS,
  RETURN_SHIPPING_METHODS,
  REFUND_TYPES,
  RETURN_ITEM_RESOLUTION_TYPES,
} from '@/config/constants';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';

interface ReturnExportData {
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  return_shipping_method: string | null;
  tracking_number: string | null;
  refund_type: string;
  refund_method?: string | null;
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
    resolution_type?: string | null;
  }[];
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

function normalizeResolutionTypeFromFallback(value: unknown): string {
  if (typeof value !== 'string') {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }

  const validKeys = new Set<string>(Object.values(RETURN_ITEM_RESOLUTION_TYPES).map((item) => item.key));
  if (validKeys.has(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'full' || lower === 'full_refund' || lower === 'full refund' || trimmed === RETURN_ITEM_RESOLUTION_TYPES.FULL.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }
  if (lower === 'partial' || lower === 'partial_refund' || lower === 'partial refund' || trimmed === RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.key;
  }
  if (lower === 'exchange' || trimmed === RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.key;
  }
  if (lower === 'round_trip' || lower === 'round trip' || trimmed === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key;
  }

  return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
}

function applyFallbackResolutionTypeToItems(
  items: Array<{ product_name: string; resolution_type?: string | null }> | null | undefined,
  fallbackValue: unknown
) {
  const fallback = normalizeResolutionTypeFromFallback(fallbackValue);
  return (items || []).map((item) => ({
    ...item,
    resolution_type: item.resolution_type || fallback,
  }));
}

export async function GET(request: NextRequest) {
  try {
    // Allow signed admin session first
    const adminSessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (await verifyAdminSessionToken(adminSessionToken)) {
      return await exportReturns(request);
    }

    // Fallback to Supabase user + admin role check
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未授權存取' },
        { status: 401 }
      );
    }

    const untypedSupabase = createUntypedAdminClient();
    const { data: profile, error: profileError } = await untypedSupabase
      .from('users')
      .select('role')
      .eq('email', user.email || '')
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return await exportReturns(request);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}

async function exportReturns(request: NextRequest) {
  const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const supabase = createAdminClient();

    const buildQuery = (includeResolutionType: boolean) => {
      const returnItemsSelect = includeResolutionType
        ? `
          product_name,
          sku:product_sku,
          quantity,
          unit_price,
          resolution_type
        `
        : `
          product_name,
          sku:product_sku,
          quantity,
          unit_price
        `;

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
            ${returnItemsSelect}
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

      return query;
    };

    let { data, error } = await buildQuery(true);
    let usedResolutionFallback = false;

    if (error && isMissingColumnError(error, 'return_items', 'resolution_type')) {
      await emitSchemaDriftAlert({
        source: 'api.admin.returns.export',
        table: 'return_items',
        column: 'resolution_type',
        errorMessage: error.message,
      });
      usedResolutionFallback = true;
      const retry = await buildQuery(false);
      data = retry.data;
      error = retry.error;
    }

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
      { header: '處理方式', key: 'resolution_type', width: 16 },
      { header: '退款方式(財務)', key: 'refund_type', width: 12 },
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
      const itemsWithResolution = usedResolutionFallback
        ? applyFallbackResolutionTypeToItems(r.return_items, r.refund_method)
        : (r.return_items || []);

      const resolutionLabels = Array.from(
        new Set(
          itemsWithResolution
            .map((item) => {
              const matched = Object.values(RETURN_ITEM_RESOLUTION_TYPES).find((type) => type.key === item.resolution_type);
              return matched?.label;
            })
            .filter(Boolean) as string[]
        )
      );
      const resolutionSummary = resolutionLabels.join('、') || RETURN_ITEM_RESOLUTION_TYPES.FULL.label;

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
        resolution_type: resolutionSummary,
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
}
