import { NextResponse } from 'next/server';
import { createBackup } from '@/lib/actions/backup.actions';

// Vercel Cron Job 會每天凌晨 3:00 UTC+8 執行
// 在 vercel.json 中設定: "0 19 * * *" (UTC 19:00 = UTC+8 03:00)

export async function GET(request: Request) {
  try {
    // 驗證是否為 Vercel Cron 請求
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // 如果沒有設定 CRON_SECRET，允許執行（開發環境）
      if (process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('Starting automatic backup...');

    // 執行自動備份（備份所有表）
    const result = await createBackup(
      ['return_management', 'shopee_returns'],
      'auto'
    );

    if (result.success) {
      console.log('Automatic backup completed successfully');
      return NextResponse.json({
        success: true,
        message: 'Backup completed',
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Automatic backup failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cron backup error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup failed' },
      { status: 500 }
    );
  }
}
