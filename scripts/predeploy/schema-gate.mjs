#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

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
  const bypass = normalizeEnvValue(process.env.SCHEMA_GATE_BYPASS).toLowerCase();
  return bypass === '1' || bypass === 'true';
}

function isMissingColumnError(errorMessage, table, column) {
  const message = String(errorMessage || '').toLowerCase();
  return (
    message.includes(`column ${table}.${column} does not exist`) ||
    message.includes(`column ${table}_1.${column} does not exist`) ||
    message.includes(`column ${table}_2.${column} does not exist`)
  );
}

async function checkRequiredColumn(supabase, table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  if (!error) {
    return { ok: true };
  }

  if (isMissingColumnError(error.message, table, column)) {
    return { ok: false, reason: 'missing_column', error: error.message };
  }

  return { ok: false, reason: 'query_error', error: error.message };
}

async function main() {
  const strict = isProductionDeployment();
  if (isBypassed()) {
    console.warn('[schema-gate] Bypassed by SCHEMA_GATE_BYPASS');
    return 0;
  }

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    const message = '[schema-gate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    if (strict) {
      console.error(`${message} (production: fail)`);
      return 1;
    }
    console.warn(`${message} (non-production: skip)`);
    return 0;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const requiredColumns = [
    { table: 'return_items', column: 'resolution_type' },
  ];

  const failures = [];
  for (const required of requiredColumns) {
    const result = await checkRequiredColumn(supabase, required.table, required.column);
    if (!result.ok) {
      failures.push({ ...required, ...result });
    }
  }

  if (failures.length === 0) {
    console.log(`[schema-gate] PASS (${requiredColumns.length} required column(s) checked).`);
    return 0;
  }

  console.error('[schema-gate] FAIL - missing required schema columns:');
  for (const failure of failures) {
    console.error(
      `  - ${failure.table}.${failure.column} (${failure.reason}): ${failure.error}`
    );
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
