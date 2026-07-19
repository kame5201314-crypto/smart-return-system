#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  ['organizations', 'onboarding_completed_at'],
  ['organizations', 'billing_email'],
  ['organizations', 'tax_id'],
  ['organizations', 'invoice_carrier'],
  ['organizations', 'suspended_at'],
  ['organizations', 'upgrade_suggested_at'],
  ['organizations', 'owner_email'],
  ['organizations', 'member_count'],
  ['organization_members', 'org_id'],
  ['organization_members', 'user_id'],
  ['organization_members', 'role'],
  ['organization_members', 'email'],
  ['organization_members', 'status'],
  ['subscriptions', 'org_id'],
  ['subscriptions', 'status'],
  ['subscriptions', 'provider'],
  ['subscriptions', 'provider_customer_id'],
  ['subscriptions', 'provider_subscription_id'],
  ['subscriptions', 'current_period_start'],
  ['subscriptions', 'current_period_end'],
  ['subscriptions', 'trial_end'],
  ['subscriptions', 'cancel_at_period_end'],
  ['subscriptions', 'canceled_at'],
  ['billing_events', 'org_id'],
  ['billing_events', 'provider'],
  ['billing_events', 'provider_event_id'],
  ['billing_events', 'event_type'],
  ['billing_events', 'status'],
  ['billing_events', 'payload'],
  ['billing_events', 'processed_at'],
  ['organization_invites', 'org_id'],
  ['organization_invites', 'email'],
  ['organization_invites', 'role'],
  ['organization_invites', 'token'],
  ['organization_invites', 'status'],
  ['organization_invites', 'expires_at'],
  ['organization_invites', 'accepted_at'],
  ['invoices', 'org_id'],
  ['invoices', 'subscription_id'],
  ['invoices', 'period_start'],
  ['invoices', 'period_end'],
  ['invoices', 'amount_twd'],
  ['invoices', 'status'],
  ['invoices', 'provider'],
  ['invoices', 'provider_invoice_id'],
  ['invoices', 'invoice_number'],
  ['invoices', 'issued_at'],
  ['invoices', 'pdf_url'],
  ['audit_logs', 'org_id'],
  ['audit_logs', 'actor_user_id'],
  ['audit_logs', 'action'],
  ['audit_logs', 'target_type'],
  ['audit_logs', 'target_id'],
  ['audit_logs', 'metadata'],
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

const billingRequiredTables = [
  'payment_orders',
  'subscription_periods',
];

const billingRequiredColumns = [
  ['organizations', 'suspension_source'],
  ['subscriptions', 'plan'],
  ['payment_orders', 'id'],
  ['payment_orders', 'org_id'],
  ['payment_orders', 'subscription_id'],
  ['payment_orders', 'provider'],
  ['payment_orders', 'provider_mode'],
  ['payment_orders', 'merchant_trade_no'],
  ['payment_orders', 'trade_no'],
  ['payment_orders', 'merchant_id'],
  ['payment_orders', 'provider_event_id'],
  ['payment_orders', 'idempotency_key'],
  ['payment_orders', 'plan'],
  ['payment_orders', 'amount_twd'],
  ['payment_orders', 'currency'],
  ['payment_orders', 'status'],
  ['payment_orders', 'simulate_paid'],
  ['payment_orders', 'rtn_code'],
  ['payment_orders', 'rtn_message'],
  ['payment_orders', 'paid_at'],
  ['payment_orders', 'expires_at'],
  ['payment_orders', 'created_by'],
  ['payment_orders', 'metadata'],
  ['payment_orders', 'created_at'],
  ['payment_orders', 'updated_at'],
  ['subscription_periods', 'id'],
  ['subscription_periods', 'org_id'],
  ['subscription_periods', 'subscription_id'],
  ['subscription_periods', 'payment_order_id'],
  ['subscription_periods', 'plan'],
  ['subscription_periods', 'provider'],
  ['subscription_periods', 'provider_mode'],
  ['subscription_periods', 'merchant_trade_no'],
  ['subscription_periods', 'trade_no'],
  ['subscription_periods', 'period_start'],
  ['subscription_periods', 'period_end'],
  ['subscription_periods', 'amount_twd'],
  ['subscription_periods', 'currency'],
  ['subscription_periods', 'status'],
  ['subscription_periods', 'created_at'],
];

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveConditionalSchemaRequirements(env = process.env) {
  const verifiedSignupExpected =
    parseBool(env.ENABLE_EMAIL_OTP_SIGNUP) ||
    parseBool(env.ENABLE_PHONE_OTP_SIGNUP) ||
    parseBool(env.SAAS_VERIFIED_SIGNUP_MIGRATION_READY);
  const billingSchemaExpected =
    parseBool(env.ENABLE_BILLING) || parseBool(env.ENABLE_SUBSCRIPTION_PLAN);

  return {
    verifiedSignupExpected,
    billingSchemaExpected,
    tablesToCheck: [
      ...requiredTables,
      ...(verifiedSignupExpected ? ['saas_self_service_trial_claims'] : []),
      ...(billingSchemaExpected ? billingRequiredTables : []),
    ],
    columnsToCheck: [
      ...requiredColumns,
      ...(verifiedSignupExpected
        ? [
            ['organizations', 'owner_phone'],
            ['organization_members', 'phone'],
            ['saas_self_service_trial_claims', 'identity_provider'],
            ['saas_self_service_trial_claims', 'normalized_phone'],
          ]
        : []),
      ...(billingSchemaExpected ? billingRequiredColumns : []),
    ],
  };
}

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

async function checkVerifiedTrialFunction(supabase) {
  const { error } = await supabase.rpc('create_verified_identity_self_service_trial', {
    p_owner_user_id: null,
    p_identity_provider: 'email_otp',
    p_owner_email: null,
    p_owner_phone: null,
    p_org_name: '',
    p_plan: 'basic',
    p_terms_version: '',
    p_terms_accepted_at: null,
    p_idempotency_key: '',
  });

  if (!error || !isMissingSchemaError(error.message)) return { ok: true };
  return { ok: false, reason: 'missing_function', error: error.message };
}

const billingFunctionProbes = [
  {
    functionName: 'create_self_service_payment_order',
    args: {
      p_org_id: null,
      p_actor_user_id: null,
      p_provider: '',
      p_provider_mode: '',
      p_plan: '',
      p_amount_twd: null,
      p_merchant_trade_no: '',
      p_idempotency_key: '',
      p_metadata: {},
    },
  },
  {
    functionName: 'process_ecpay_payment_notification',
    args: {
      p_merchant_trade_no: '',
      p_provider_event_id: '',
      p_trade_no: null,
      p_merchant_id: null,
      p_provider_mode: '',
      p_trade_amount_twd: null,
      p_rtn_code: null,
      p_rtn_message: '',
      p_simulate_paid: true,
      p_payment_date: null,
      p_payload: {},
    },
  },
];

export async function checkBillingFunctions(supabase) {
  const failures = [];

  for (const probe of billingFunctionProbes) {
    // These deliberately invalid arguments are rejected before either RPC can
    // create or settle a payment. A business-validation error therefore proves
    // the RPC is callable; only a missing schema/function response fails the
    // readiness gate.
    const { error } = await supabase.rpc(probe.functionName, probe.args);
    if (error && isMissingSchemaError(error.message)) {
      failures.push({
        functionName: probe.functionName,
        reason: 'missing_function',
        error: error.message,
      });
    }
  }

  return failures;
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
  const {
    verifiedSignupExpected,
    billingSchemaExpected,
    tablesToCheck,
    columnsToCheck,
  } = resolveConditionalSchemaRequirements(process.env);

  for (const table of tablesToCheck) {
    const result = await checkTable(supabase, table);
    if (!result.ok) {
      failures.push({ kind: 'table', table, ...result });
    }
  }

  for (const [table, column] of columnsToCheck) {
    const result = await checkColumn(supabase, table, column);
    if (!result.ok) {
      failures.push({ kind: 'column', table, column, ...result });
    }
  }

  if (verifiedSignupExpected) {
    const result = await checkVerifiedTrialFunction(supabase);
    if (!result.ok) {
      failures.push({
        kind: 'function',
        functionName: 'create_verified_identity_self_service_trial',
        ...result,
      });
    }
  }

  if (billingSchemaExpected) {
    failures.push(
      ...(await checkBillingFunctions(supabase)).map((result) => ({
        kind: 'function',
        ...result,
      }))
    );
  }

  if (failures.length === 0) {
    console.log(
      `[saas-schema-gate] PASS (${tablesToCheck.length} table(s), ${columnsToCheck.length} column(s) checked${verifiedSignupExpected ? ', verified signup RPC checked' : ''}${billingSchemaExpected ? ', billing RPCs checked' : ''}).`
    );
    return 0;
  }

  const modeLabel = strict ? 'strict mode: fail' : 'non-strict mode: warn';
  console.error(`[saas-schema-gate] FAIL - required SaaS schema is not ready (${modeLabel}):`);
  for (const failure of failures) {
    const target =
      failure.kind === 'table'
        ? failure.table
        : failure.kind === 'function'
          ? failure.functionName
          : `${failure.table}.${failure.column}`;
    console.error(`  - ${target} (${failure.reason}): ${failure.error}`);
  }

  return strict ? 1 : 0;
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
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
}
