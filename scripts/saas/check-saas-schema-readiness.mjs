#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value, defaultValue = false) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  return defaultValue;
}

function isProductionDeployment() {
  const isVercel = normalizeEnvValue(process.env.VERCEL) === '1';
  const vercelEnv = normalizeEnvValue(process.env.VERCEL_ENV).toLowerCase();
  return isVercel && vercelEnv === 'production';
}

function isStrictMode(argv = process.argv.slice(2)) {
  if (argv.includes('--strict')) return true;
  if (parseBool(process.env.SAAS_SCHEMA_GATE_STRICT, false)) return true;
  return isProductionDeployment();
}

function isBypassed() {
  return parseBool(process.env.SAAS_SCHEMA_GATE_BYPASS, false);
}

function isMissingSchemaError(errorMessage) {
  const message = String(errorMessage || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('schema cache') ||
    message.includes('42p01') ||
    message.includes('42703')
  );
}

const requiredTables = [
  'organizations',
  'organization_members',
  'subscriptions',
  'billing_events',
  'organization_invites',
  'invoices',
  'audit_logs',
  'signup_requests',
  'ai_usage_events',
  'return_requests',
  'return_items',
  'return_images',
  'inspection_records',
  'orders',
  'order_items',
  'customers',
  'products',
  'pickup_records',
  'shopee_returns',
  'shopee_scan_events',
  'shopee_unmatched_scans',
  'scan_audit_logs',
];

const requiredColumns = [
  ['organizations', 'plan'],
  ['organizations', 'status'],
  ['organizations', 'feature_flags'],
  ['organizations', 'billing_email'],
  ['organizations', 'tax_id'],
  ['organization_members', 'org_id'],
  ['organization_members', 'user_id'],
  ['organization_members', 'role'],
  ['subscriptions', 'org_id'],
  ['subscriptions', 'status'],
  ['subscriptions', 'trial_end'],
  ['subscriptions', 'cancel_at_period_end'],
  ['billing_events', 'org_id'],
  ['billing_events', 'provider'],
  ['billing_events', 'provider_event_id'],
  ['billing_events', 'event_type'],
  ['billing_events', 'payload'],
  ['organization_invites', 'org_id'],
  ['organization_invites', 'email'],
  ['organization_invites', 'role'],
  ['invoices', 'org_id'],
  ['invoices', 'amount_twd'],
  ['audit_logs', 'org_id'],
  ['audit_logs', 'action'],
  ['signup_requests', 'company_name'],
  ['signup_requests', 'contact_name'],
  ['signup_requests', 'email'],
  ['signup_requests', 'plan'],
  ['signup_requests', 'status'],
  ['signup_requests', 'source'],
  ['signup_requests', 'org_id'],
  ['ai_usage_events', 'org_id'],
  ['ai_usage_events', 'feature'],
  ['ai_usage_events', 'report_period'],
  ['ai_usage_events', 'cached'],
  ['ai_usage_events', 'success'],
  ['return_requests', 'org_id'],
  ['return_items', 'org_id'],
  ['return_images', 'org_id'],
  ['inspection_records', 'org_id'],
  ['orders', 'org_id'],
  ['order_items', 'org_id'],
  ['customers', 'org_id'],
  ['products', 'org_id'],
  ['pickup_records', 'org_id'],
  ['shopee_returns', 'org_id'],
  ['shopee_scan_events', 'org_id'],
  ['shopee_unmatched_scans', 'org_id'],
  ['scan_audit_logs', 'org_id'],
];

async function checkTable(supabase, table) {
  const { error } = await supabase
    .from(table)
    .select('id')
    .limit(1);

  if (!error) return { ok: true };
  return {
    ok: false,
    reason: isMissingSchemaError(error.message) ? 'missing_table' : 'query_error',
    error: error.message,
  };
}

async function checkColumn(supabase, table, column) {
  const { error } = await supabase
    .from(table)
    .select(column)
    .limit(1);

  if (!error) return { ok: true };
  return {
    ok: false,
    reason: isMissingSchemaError(error.message) ? 'missing_column_or_table' : 'query_error',
    error: error.message,
  };
}

async function main() {
  const strict = isStrictMode();

  if (isBypassed()) {
    console.warn('[saas-schema-gate] Bypassed by SAAS_SCHEMA_GATE_BYPASS');
    return 0;
  }

  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  if (appMode && appMode !== 'saas') {
    console.error(`[saas-schema-gate] APP_MODE must be saas, got ${appMode}`);
    return 1;
  }

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    const message = '[saas-schema-gate] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      return 1;
    }
    console.warn(`${message} (non-strict mode: skip)`);
    return 0;
  }

  const expectedProjectId = normalizeEnvValue(process.env.SAAS_SUPABASE_PROJECT_ID)
    || normalizeEnvValue(process.env.SUPABASE_PROJECT_ID_EXPECTED);
  if (expectedProjectId && !supabaseUrl.includes(expectedProjectId)) {
    console.error(`[saas-schema-gate] Supabase URL does not match SaaS project id ${expectedProjectId}`);
    return 1;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const failures = [];

  for (const table of requiredTables) {
    const result = await checkTable(supabase, table);
    if (!result.ok) {
      failures.push({ kind: 'table', table, ...result });
    }
  }

  for (const [table, column] of requiredColumns) {
    const result = await checkColumn(supabase, table, column);
    if (!result.ok) {
      failures.push({ kind: 'column', table, column, ...result });
    }
  }

  if (failures.length === 0) {
    console.log(
      `[saas-schema-gate] PASS (${requiredTables.length} table(s), ${requiredColumns.length} column(s) checked).`
    );
    return 0;
  }

  const modeLabel = strict ? 'strict mode: fail' : 'non-strict mode: warn';
  console.error(`[saas-schema-gate] FAIL - required SaaS schema is not ready (${modeLabel}):`);
  for (const failure of failures) {
    const target =
      failure.kind === 'table'
        ? failure.table
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
    console.error('[saas-schema-gate] Unexpected error:', error);
    process.exitCode = 1;
  });
