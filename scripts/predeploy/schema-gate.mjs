#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

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
  if (parseBool(process.env.SCHEMA_GATE_STRICT, false)) return true;
  return isProductionDeployment();
}

function isBypassed() {
  return parseBool(process.env.SCHEMA_GATE_BYPASS, false);
}

function isMissingSchemaError(errorMessage) {
  const message = String(errorMessage || '').toLowerCase();
  return (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
    || message.includes('42p01')
    || message.includes('42703')
  );
}

async function checkRequiredTable(supabase, table) {
  const { error } = await supabase
    .from(table)
    .select('*', { head: true, count: 'exact' });

  if (!error) {
    return { ok: true };
  }

  if (isMissingSchemaError(error.message)) {
    return { ok: false, reason: 'missing_table', error: error.message };
  }

  return { ok: false, reason: 'query_error', error: error.message };
}

async function checkRequiredColumn(supabase, table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  if (!error) {
    return { ok: true };
  }

  if (isMissingSchemaError(error.message)) {
    return { ok: false, reason: 'missing_column_or_table', error: error.message };
  }

  return { ok: false, reason: 'query_error', error: error.message };
}

async function main() {
  const strict = isStrictMode();
  if (isBypassed()) {
    console.warn('[schema-gate] Bypassed by SCHEMA_GATE_BYPASS');
    return 0;
  }

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    const message = '[schema-gate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      return 1;
    }
    console.warn(`${message} (non-strict mode: skip)`);
    return 0;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const requiredTables = [
    { table: 'shopee_scan_events' },
    { table: 'shopee_unmatched_scans' },
    { table: 'shopee_scan_daily_kpis' },
    { table: 'scan_audit_logs' },
  ];

  const requiredColumns = [
    { table: 'return_items', column: 'resolution_type' },
    { table: 'shopee_returns', column: 'order_number_norm' },
    { table: 'shopee_returns', column: 'tracking_number_norm' },
    { table: 'shopee_returns', column: 'is_scanned' },
    { table: 'shopee_returns', column: 'is_inbound' },
    { table: 'pickup_records', column: 'is_scanned' },
    { table: 'pickup_records', column: 'scanned_at' },
  ];

  const failures = [];

  for (const required of requiredTables) {
    const result = await checkRequiredTable(supabase, required.table);
    if (!result.ok) {
      failures.push({ kind: 'table', ...required, ...result });
    }
  }

  for (const required of requiredColumns) {
    const result = await checkRequiredColumn(supabase, required.table, required.column);
    if (!result.ok) {
      failures.push({ kind: 'column', ...required, ...result });
    }
  }

  if (failures.length === 0) {
    console.log(
      `[schema-gate] PASS (${requiredTables.length} table(s), ${requiredColumns.length} column(s) checked).`
    );
    return 0;
  }

  console.error('[schema-gate] FAIL - required schema checks did not pass:');
  for (const failure of failures) {
    const target = failure.kind === 'table'
      ? `${failure.table}`
      : `${failure.table}.${failure.column}`;
    console.error(`  - ${target} (${failure.reason}): ${failure.error}`);
  }

  return strict ? 1 : 0;
}

main()
  .then((exitCode) => {
    if (exitCode && exitCode !== 0) {
      process.exitCode = exitCode;
    }
  })
  .catch((error) => {
    console.error('[schema-gate] Unexpected error:', error);
    process.exitCode = 1;
  });
