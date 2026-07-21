#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXPECTED_BRANCH = 'develop-saas';
const EXPECTED_LAST_MIGRATION = '049_saas_custom_plan_offers.sql';
const REQUIRED_BASE_MIGRATIONS = [
  '001_return_system_schema.sql',
  '002_rls_and_init_data.sql',
  '022_ai_usage_events.sql',
];
const REQUIRED_SAAS_MIGRATIONS = [
  '023_saas_commercial_foundation.sql',
  '024_saas_commercial_v2.sql',
  '025_attach_org_id_to_business_tables.sql',
  '026_saas_public_signup_requests.sql',
  '027_saas_platform_admin_read_model.sql',
  '028_saas_manual_beta_org_provisioning.sql',
  '029_saas_billing_event_status.sql',
  '030_saas_invoice_status_alignment.sql',
  '031_saas_invite_acceptance_rpc.sql',
  '032_saas_invite_creation_rpc.sql',
  '033_saas_platform_billing_operations.sql',
  '034_saas_notification_email_queue.sql',
  '035_saas_onboarding_completion_rpc.sql',
  '036_saas_platform_admin_roles.sql',
  '037_saas_team_invite_status.sql',
  '038_saas_org_member_visibility.sql',
  '039_saas_public_lead_capture.sql',
  '040_saas_google_self_service_trial.sql',
  '041_saas_scoped_trial_expiry.sql',
  '042_saas_scope_trial_expiry_to_self_service.sql',
  '043_saas_google_trial_claims_service_role_read.sql',
  '044_saas_verified_identity_self_service_trial.sql',
  '045_saas_suspended_org_write_guards.sql',
  '046_saas_self_service_billing.sql',
  '047_saas_billing_table_privileges.sql',
  '048_saas_checkout_order_hardening.sql',
  '049_saas_custom_plan_offers.sql',
];
const DEFAULT_FORBIDDEN_SUPABASE_REFS = [
  'fdzfnenizyppxglypden',
  'sntbrntwztkllwkutooi',
];

const strict = process.argv.includes('--strict') || parseBool(process.env.SAAS_MIGRATION_PLAN_STRICT);
const checks = [];

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function record(status, label, detail = '') {
  checks.push({ status, label, detail });
}

function gitOutput(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function failOrWarn(label, detail) {
  record(strict ? 'fail' : 'warn', label, detail);
}

function checkBranch() {
  if (parseBool(process.env.SAAS_MIGRATION_PLAN_SKIP_GIT_CHECK)) {
    record('warn', 'Git branch', 'skipped by SAAS_MIGRATION_PLAN_SKIP_GIT_CHECK');
    return;
  }

  const branch = gitOutput('git rev-parse --abbrev-ref HEAD');
  if (branch === EXPECTED_BRANCH) {
    record('pass', 'Git branch', branch);
  } else {
    record('fail', 'Git branch', `expected ${EXPECTED_BRANCH}, got ${branch || '(unknown)'}`);
  }

  const porcelain = gitOutput('git status --porcelain');
  if (porcelain) {
    record('warn', 'Working tree', 'has local changes; review before applying migrations');
  } else {
    record('pass', 'Working tree', 'clean');
  }
}

function checkSaasProjectEnv() {
  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  const saasRef = normalizeEnvValue(process.env.SAAS_SUPABASE_PROJECT_ID);
  const expectedRef =
    normalizeEnvValue(process.env.SUPABASE_PROJECT_ID_EXPECTED) || saasRef;
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const internalRef = normalizeEnvValue(process.env.INTERNAL_SUPABASE_PROJECT_ID);
  const forbiddenRefs = new Set(
    [...DEFAULT_FORBIDDEN_SUPABASE_REFS, internalRef].filter(Boolean)
  );

  if (appMode === 'saas') {
    record('pass', 'APP_MODE', appMode);
  } else {
    record('fail', 'APP_MODE', `expected saas, got ${appMode || '(missing)'}`);
  }

  if (!saasRef) {
    record('fail', 'SAAS_SUPABASE_PROJECT_ID', 'missing');
  } else {
    record('pass', 'SAAS_SUPABASE_PROJECT_ID', saasRef);
  }

  if (!expectedRef) {
    record('fail', 'SUPABASE_PROJECT_ID_EXPECTED', 'missing');
  } else if (saasRef && expectedRef !== saasRef) {
    record(
      'fail',
      'SUPABASE_PROJECT_ID_EXPECTED',
      `expected to match SAAS_SUPABASE_PROJECT_ID (${saasRef}), got ${expectedRef}`
    );
  } else {
    record('pass', 'SUPABASE_PROJECT_ID_EXPECTED', expectedRef);
  }

  for (const forbiddenRef of forbiddenRefs) {
    if (
      expectedRef === forbiddenRef ||
      saasRef === forbiddenRef ||
      supabaseUrl.includes(forbiddenRef)
    ) {
      record('fail', 'Supabase project safety', `forbidden Supabase project ref: ${forbiddenRef}`);
      return;
    }
  }
  record('pass', 'Supabase project safety', 'not internal/live project refs');

  if (!supabaseUrl) {
    record('fail', 'NEXT_PUBLIC_SUPABASE_URL', 'missing');
  } else if (expectedRef && !supabaseUrl.includes(expectedRef)) {
    record(
      'fail',
      'NEXT_PUBLIC_SUPABASE_URL',
      `URL does not include expected SaaS ref ${expectedRef}`
    );
  } else {
    record('pass', 'NEXT_PUBLIC_SUPABASE_URL', 'matches expected SaaS ref');
  }

  if (normalizeEnvValue(process.env.SUPABASE_DB_PASSWORD)) {
    record('pass', 'SUPABASE_DB_PASSWORD', 'set');
  } else {
    failOrWarn(
      'SUPABASE_DB_PASSWORD',
      'missing; required before running supabase db push against the SaaS project'
    );
  }
}

function checkMigrationFiles() {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    record('fail', 'Migration directory', 'missing supabase/migrations');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    record('fail', 'Migration files', 'no .sql files found');
    return;
  }

  const missingBase = REQUIRED_BASE_MIGRATIONS.filter((file) => !files.includes(file));
  const missingSaas = REQUIRED_SAAS_MIGRATIONS.filter((file) => !files.includes(file));

  if (missingBase.length === 0) {
    record('pass', 'Base migrations', REQUIRED_BASE_MIGRATIONS.join(', '));
  } else {
    record('fail', 'Base migrations', `missing ${missingBase.join(', ')}`);
  }

  if (missingSaas.length === 0) {
    record('pass', 'SaaS migrations', REQUIRED_SAAS_MIGRATIONS.join(', '));
  } else {
    record('fail', 'SaaS migrations', `missing ${missingSaas.join(', ')}`);
  }

  if (files[files.length - 1] === EXPECTED_LAST_MIGRATION) {
    record('pass', 'Migration chain end', EXPECTED_LAST_MIGRATION);
  } else {
    record(
      'fail',
      'Migration chain end',
      `expected ${EXPECTED_LAST_MIGRATION}, got ${files[files.length - 1]}`
    );
  }

  record('pass', 'Migration plan', `${files.length} migration files, full chain only`);
}

function printSummary() {
  for (const check of checks) {
    const prefix = `[saas-migration-plan] ${check.status.toUpperCase()}: ${check.label}`;
    console.log(check.detail ? `${prefix} - ${check.detail}` : prefix);
  }

  const failCount = checks.filter((check) => check.status === 'fail').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const passCount = checks.filter((check) => check.status === 'pass').length;

  console.log(
    `\n[saas-migration-plan] Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`
  );
  console.log('[saas-migration-plan] No migrations were applied by this check.');

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

checkBranch();
checkSaasProjectEnv();
checkMigrationFiles();
printSummary();
