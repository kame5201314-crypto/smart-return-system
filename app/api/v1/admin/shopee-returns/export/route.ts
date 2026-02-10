import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { createClient } from '@/lib/supabase/server';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';

interface ShopeeReturnExportData {
  id: string;
  order_number: string;
  tracking_number: string | null;
  order_date: string | null;
  dispute_deadline: string | null;
  refund_amount: number | null;
  product_name: string | null;
  option_name: string | null;
  option_sku: string | null;
  return_quantity: number;
  return_reason: string | null;
  buyer_note: string | null;
  shipping_method: string | null;
  processed_at: string | null;
  is_scanned: boolean;
  is_processed: boolean;
  is_printed: boolean;
  platform: 'shopee' | 'mall' | null;
  color_tag: 'yellow' | 'red' | null;
  note: string | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    // Allow signed admin session first
    const adminSessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (await verifyAdminSessionToken(adminSessionToken)) {
      return await exportShopeeReturns();
    }

    // Fallback to Supabase user + admin role check
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
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

    return await exportShopeeReturns();
  } catch (error) {
    console.error('Shopee returns export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}

async function exportShopeeReturns() {
  const supabase = createUntypedAdminClient();

  const { data, error } = await supabase
    .from('shopee_returns')
    .select('*')
    .order('imported_at', { ascending: false });

  if (error) {
    console.error('Export shopee returns fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('蝦皮退貨');

  worksheet.columns = [
    { header: '平台', key: 'platform', width: 8 },
    { header: '訂單編號', key: 'order_number', width: 20 },
    { header: '退貨寄件編號', key: 'tracking_number', width: 18 },
    { header: '訂單日期', key: 'order_date', width: 12 },
    { header: '爭議申請期限', key: 'dispute_deadline', width: 14 },
    { header: '買家退款金額', key: 'refund_amount', width: 12 },
    { header: '商品名稱', key: 'product_name', width: 40 },
    { header: '商品規格名稱', key: 'option_name', width: 26 },
    { header: '貨號', key: 'option_sku', width: 16 },
    { header: '數量', key: 'return_quantity', width: 8 },
    { header: '退貨原因', key: 'return_reason', width: 24 },
    { header: '買家備註', key: 'buyer_note', width: 40 },
    { header: '退貨物流方式', key: 'shipping_method', width: 16 },
    { header: '處理日期', key: 'processed_at', width: 12 },
    { header: '已入庫', key: 'is_scanned', width: 8 },
    { header: '已處理', key: 'is_processed', width: 8 },
    { header: '已列印', key: 'is_printed', width: 8 },
    { header: '顏色標記', key: 'color_tag', width: 10 },
    { header: '備註', key: 'note', width: 30 },
    { header: '匯入時間', key: 'imported_at', width: 20 },
    { header: '建立時間', key: 'created_at', width: 20 },
    { header: '更新時間', key: 'updated_at', width: 20 },
  ];

  worksheet.getRow(1).font = { bold: true };

  (data as ShopeeReturnExportData[] | null)?.forEach((r) => {
    worksheet.addRow({
      platform: r.platform === 'mall' ? '商城' : (r.platform === 'shopee' ? '蝦皮' : ''),
      order_number: r.order_number,
      tracking_number: r.tracking_number || '',
      order_date: r.order_date || '',
      dispute_deadline: r.dispute_deadline || '',
      refund_amount: r.refund_amount ?? '',
      product_name: r.product_name || '',
      option_name: r.option_name || '',
      option_sku: r.option_sku || '',
      return_quantity: r.return_quantity ?? 0,
      return_reason: r.return_reason || '',
      buyer_note: r.buyer_note || '',
      shipping_method: r.shipping_method || '',
      processed_at: r.processed_at ? r.processed_at.slice(0, 10) : '',
      is_scanned: r.is_scanned ? 'Y' : '',
      is_processed: r.is_processed ? 'Y' : '',
      is_printed: r.is_printed ? 'Y' : '',
      color_tag: r.color_tag || '',
      note: r.note || '',
      imported_at: r.imported_at || '',
      created_at: r.created_at || '',
      updated_at: r.updated_at || '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `蝦皮退貨匯出_${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

