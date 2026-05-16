#!/usr/bin/env node

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value, defaultValue = false) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) return defaultValue;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return defaultValue;
}

function isProductionDeployment() {
  const isVercel = normalizeEnvValue(process.env.VERCEL) === '1';
  const vercelEnv = normalizeEnvValue(process.env.VERCEL_ENV).toLowerCase();
  return isVercel && vercelEnv === 'production';
}

function isStrictMode() {
  if (parseBool(process.env.SUPABASE_PROJECT_CHECK_STRICT, false)) return true;
  return isProductionDeployment();
}

function isBypassed() {
  return parseBool(process.env.SUPABASE_PROJECT_CHECK_BYPASS, false);
}

function main() {
  if (isBypassed()) {
    console.warn('[supabase-project-check] Bypassed by SUPABASE_PROJECT_CHECK_BYPASS');
    return;
  }

  const strict = isStrictMode();
  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  const defaultProjectId =
    appMode === 'saas'
      ? normalizeEnvValue(process.env.SAAS_SUPABASE_PROJECT_ID)
      : normalizeEnvValue(process.env.INTERNAL_SUPABASE_PROJECT_ID);
  const expectedProjectId =
    normalizeEnvValue(process.env.SUPABASE_PROJECT_ID_EXPECTED)
    || defaultProjectId
    || 'fdzfnenizyppxglypden';
  const internalProjectId =
    normalizeEnvValue(process.env.INTERNAL_SUPABASE_PROJECT_ID)
    || 'fdzfnenizyppxglypden';
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!supabaseUrl) {
    const message = '[supabase-project-check] NEXT_PUBLIC_SUPABASE_URL is not set';
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      process.exitCode = 1;
      return;
    }
    console.warn(`${message} (non-strict mode: skip)`);
    return;
  }

  if (!supabaseUrl.includes(expectedProjectId)) {
    const message = `[supabase-project-check] NEXT_PUBLIC_SUPABASE_URL does not include expected project id (${expectedProjectId})`;
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      process.exitCode = 1;
      return;
    }
    console.warn(`${message} (non-strict mode: warning)`);
    return;
  }

  if (appMode === 'saas' && internalProjectId && supabaseUrl.includes(internalProjectId)) {
    const message = `[supabase-project-check] APP_MODE=saas cannot use internal project id (${internalProjectId})`;
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      process.exitCode = 1;
      return;
    }
    console.warn(`${message} (non-strict mode: warning)`);
    return;
  }

  console.log(`[supabase-project-check] PASS (project id: ${expectedProjectId})`);
}

main();
