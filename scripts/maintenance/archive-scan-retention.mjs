#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function main() {
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const scanEventRetentionDays = parsePositiveInt(
    process.env.SCAN_EVENTS_RETENTION_DAYS,
    180
  );
  const unmatchedRetentionDays = parsePositiveInt(
    process.env.UNMATCHED_SCANS_RETENTION_DAYS,
    90
  );
  const batchLimit = parsePositiveInt(
    process.env.SCAN_RETENTION_BATCH_LIMIT,
    5000
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.rpc('archive_old_scan_data', {
    p_scan_event_retention_days: scanEventRetentionDays,
    p_unmatched_retention_days: unmatchedRetentionDays,
    p_batch_limit: batchLimit,
  });

  if (error) {
    throw new Error(`archive_old_scan_data failed: ${error.message}`);
  }

  const summary = Array.isArray(data) && data.length > 0 ? data[0] : {};
  console.log(
    JSON.stringify(
      {
        ok: true,
        scanEventRetentionDays,
        unmatchedRetentionDays,
        batchLimit,
        summary,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[archive-scan-retention] Failed:', message);
  process.exitCode = 1;
});
