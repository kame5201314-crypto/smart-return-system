import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { getOrgContext, SaaSOrgContextError } from '@/lib/saas/org-context';

interface PickupRecordExportData {
  id: string;
  process_date: string;
  order_number: string;
  tracking_number: string | null;
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  receiver_info: string | null;
  notes: string | null;
  is_printed: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const orgContext = await getOrgContext({
      requirements: {
        roles: ['owner', 'admin', 'staff'],
      },
    });

    return await exportPickupRecords(orgContext.orgId);
  } catch (error) {
    if (error instanceof SaaSOrgContextError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error('Pickup records export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    );
  }
}

async function exportPickupRecords(orgId: string) {
  const supabase = createUntypedAdminClient();

  const { data, error } = await supabase
    .from('pickup_records')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Export pickup records fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('派車收件');

  worksheet.columns = [
    { header: '處理日期', key: 'process_date', width: 12 },
    { header: '訂單編號', key: 'order_number', width: 24 },
    { header: '物流單號', key: 'tracking_number', width: 18 },
    { header: '平台', key: 'platform', width: 10 },
    { header: '物流', key: 'logistics_provider', width: 10 },
    { header: '物流狀態', key: 'delivery_status', width: 12 },
    { header: '收到/已貼', key: 'received_status', width: 12 },
    { header: '收件人姓名', key: 'receiver_info', width: 20 },
    { header: '備註', key: 'notes', width: 30 },
    { header: '已列印', key: 'is_printed', width: 8 },
    { header: '建立時間', key: 'created_at', width: 20 },
    { header: '更新時間', key: 'updated_at', width: 20 },
  ];

  worksheet.getRow(1).font = { bold: true };

  (data as PickupRecordExportData[] | null)?.forEach((r) => {
    worksheet.addRow({
      process_date: r.process_date ? r.process_date.slice(0, 10) : '',
      order_number: r.order_number || '',
      tracking_number: r.tracking_number || '',
      platform: r.platform || '',
      logistics_provider: r.logistics_provider || '',
      delivery_status: r.delivery_status || '',
      received_status: r.received_status || '',
      receiver_info: r.receiver_info || '',
      notes: r.notes || '',
      is_printed: r.is_printed ? 'Y' : '',
      created_at: r.created_at || '',
      updated_at: r.updated_at || '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `派車收件匯出_${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
