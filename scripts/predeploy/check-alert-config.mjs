#!/usr/bin/env node

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function isProductionDeployment() {
  const isVercel = normalizeEnvValue(process.env.VERCEL) === '1';
  const vercelEnv = normalizeEnvValue(process.env.VERCEL_ENV).toLowerCase();
  return isVercel && vercelEnv === 'production';
}

function isBypassed() {
  const bypass = normalizeEnvValue(process.env.ALERT_CONFIG_BYPASS).toLowerCase();
  return bypass === '1' || bypass === 'true';
}

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function main() {
  if (isBypassed()) {
    if (isProductionDeployment()) {
      console.error('[alert-config] ALERT_CONFIG_BYPASS is not allowed in production; failing closed.');
      process.exitCode = 1;
      return;
    }
    console.warn('[alert-config] Bypassed by ALERT_CONFIG_BYPASS (allowed in local/dev only)');
    return;
  }

  const strict = isProductionDeployment();
  const webhookUrl = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_WEBHOOK_URL);
  const alertToken = normalizeEnvValue(process.env.SCHEMA_DRIFT_ALERT_TOKEN);
  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);

  const problems = [];

  if (!webhookUrl) {
    problems.push('SCHEMA_DRIFT_ALERT_WEBHOOK_URL is not set');
  } else if (!isValidHttpUrl(webhookUrl)) {
    problems.push('SCHEMA_DRIFT_ALERT_WEBHOOK_URL is not a valid HTTP/HTTPS URL');
  }

  if (!cronSecret) {
    problems.push('CRON_SECRET is not set');
  } else if (cronSecret.length < 20) {
    problems.push('CRON_SECRET is too short (recommended >= 20 chars)');
  }

  if (!alertToken) {
    problems.push('SCHEMA_DRIFT_ALERT_TOKEN is not set');
  } else if (alertToken.length < 20) {
    problems.push('SCHEMA_DRIFT_ALERT_TOKEN is too short (recommended >= 20 chars)');
  }

  if (problems.length === 0) {
    console.log('[alert-config] PASS');
    return;
  }

  for (const problem of problems) {
    console.error(`[alert-config] ${problem}`);
  }

  if (strict) {
    process.exitCode = 1;
    return;
  }

  console.warn('[alert-config] Non-production mode: warnings only');
}

main();
