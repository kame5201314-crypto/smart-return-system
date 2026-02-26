#!/usr/bin/env node

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const baseArg = args.find((arg) => arg.startsWith('--base-url='));
  return {
    baseUrl: baseArg ? baseArg.split('=')[1].trim() : '',
  };
}

function ensureBaseUrl(baseUrlArg) {
  const resolved = normalizeEnvValue(baseUrlArg || process.env.NEXT_PUBLIC_APP_URL);
  if (!resolved) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL (or pass --base-url=https://your-domain)');
  }
  return resolved.replace(/\/+$/, '');
}

async function main() {
  const { baseUrl } = parseArgs(process.argv);
  const resolvedBaseUrl = ensureBaseUrl(baseUrl);
  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);

  if (!cronSecret) {
    throw new Error('Missing CRON_SECRET');
  }

  const response = await fetch(`${resolvedBaseUrl}/api/cron/shopee-scan-smoke`, {
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

  console.log(JSON.stringify({
    baseUrl: resolvedBaseUrl,
    status: response.status,
    ok: response.ok,
    payload,
  }, null, 2));

  if (!response.ok || !payload?.success) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[postdeploy-shopee-scan-smoke] Failed:', message);
  process.exitCode = 1;
});
