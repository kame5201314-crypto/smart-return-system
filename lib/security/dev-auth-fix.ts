type DevAuthFixEnvironment = Readonly<Record<string, string | undefined>>;

function normalizeEnvValue(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isDevAuthFixAllowed(env: DevAuthFixEnvironment): boolean {
  const appMode = normalizeEnvValue(env.APP_MODE);
  const allowDevAuthFix = normalizeEnvValue(env.ALLOW_DEV_AUTH_FIX) === 'true';

  return (appMode === 'development' || appMode === 'local') && allowDevAuthFix;
}
