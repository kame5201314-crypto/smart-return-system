export function isPlatformMaintenanceCronEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = (env.ENABLE_PLATFORM_MAINTENANCE_CRON || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function buildPlatformMaintenanceCronSkip(source: string): {
  success: true;
  skipped: true;
  source: string;
  reason: string;
  timestamp: string;
} {
  return {
    success: true,
    skipped: true,
    source,
    reason: 'ENABLE_PLATFORM_MAINTENANCE_CRON is not enabled',
    timestamp: new Date().toISOString(),
  };
}
