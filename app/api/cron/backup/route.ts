import { NextResponse } from 'next/server';
import { createBackup } from '@/lib/actions/backup.actions';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProduction && !cronSecret) {
      console.error('CRON_SECRET is not configured in production environment');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!cronSecret && !isProduction) {
      console.warn('CRON_SECRET not set - allowing request in development mode');
    }

    const backupOrgId = (process.env.SAAS_BACKUP_ORG_ID || '').trim();
    if (!backupOrgId) {
      console.warn('SAAS_BACKUP_ORG_ID is not configured; skipping tenant-scoped backup cron.');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'SAAS_BACKUP_ORG_ID is not configured',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await createBackup(
      ['return_management', 'shopee_returns', 'pickup'],
      'auto',
      undefined,
      {
        orgId: backupOrgId,
        source: 'cron',
      }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Backup completed',
        orgId: backupOrgId,
        timestamp: new Date().toISOString(),
      });
    }

    console.error('Automatic backup failed:', result.error);
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  } catch (error) {
    console.error('Cron backup error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup failed' },
      { status: 500 }
    );
  }
}
