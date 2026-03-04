#!/usr/bin/env node

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const baseArg = args.find((arg) => arg.startsWith('--base-url='));
  const baseUrl = baseArg ? baseArg.split('=')[1] : '';

  const onlyArg = args.find((arg) => arg.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1].trim() : '';

  return {
    baseUrl: baseUrl.trim(),
    only,
  };
}

function ensureBaseUrl(url) {
  const normalized = normalizeEnvValue(url || process.env.NEXT_PUBLIC_APP_URL);
  if (!normalized) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL (or pass --base-url=https://your-domain)');
  }
  return normalized.replace(/\/+$/, '');
}

async function callCronEndpoint(baseUrl, path, cronSecret) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    path,
    status: response.status,
    ok: response.ok,
    payload,
  };
}

async function main() {
  const { baseUrl, only } = parseArgs(process.argv);
  const resolvedBaseUrl = ensureBaseUrl(baseUrl);
  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);

  if (!cronSecret) {
    throw new Error('Missing CRON_SECRET');
  }

  const targets = [
    '/api/cron/backup',
    '/api/cron/reconcile-ai-reports',
    '/api/cron/shopee-scan-daily-report',
    '/api/cron/shopee-scan-smoke',
    '/api/cron/scan-retention',
  ].filter((path) => !only || path.includes(only));

  if (targets.length === 0) {
    throw new Error(`No cron endpoint matched --only=${only}`);
  }

  const results = [];
  for (const path of targets) {
    const result = await callCronEndpoint(resolvedBaseUrl, path, cronSecret);
    results.push(result);
  }

  console.log(JSON.stringify({
    baseUrl: resolvedBaseUrl,
    checked: results.length,
    results,
  }, null, 2));

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[cron-drill] Failed:', message);
  process.exitCode = 1;
});
