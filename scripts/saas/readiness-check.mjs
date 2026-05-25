#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

const DEFAULT_SAAS_BRANCH = 'develop-saas';
const DEFAULT_SAAS_PROJECT_NAME = 'smart-return-system-saas';
const DEFAULT_SAAS_PROJECT_ID = 'prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8';
const DEFAULT_INTERNAL_PROJECT_ID = 'prj_aaRiMeML9D4G7U71QRDZYVonLH8h';
const DEFAULT_INTERNAL_SUPABASE_PROJECT_ID = 'fdzfnenizyppxglypden';
const FEATURE_FLAG_DEFAULTS = {
  ENABLE_PUBLIC_SIGNUP: 'false',
  ENABLE_BILLING: 'false',
  ENABLE_SUBSCRIPTION_PLAN: 'false',
  ENABLE_AI_USAGE_LIMIT: 'true',
  ENABLE_ADVANCED_ANALYTICS: 'false',
  ENABLE_MULTI_TENANT_ADMIN: 'false',
  ENABLE_IMAGE_AI: 'false',
};
const BILLING_PROVIDER_KEYS = {
  ecpay: ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV', 'ECPAY_MODE'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_BASIC', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_PRO'],
  tappay: ['TAPPAY_PARTNER_KEY', 'TAPPAY_MERCHANT_ID', 'TAPPAY_APP_ID', 'TAPPAY_APP_KEY', 'TAPPAY_MODE'],
};

const strict = process.argv.includes('--strict');
const checks = [];

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function isPlaceholder(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return (
    !normalized ||
    normalized.includes('replace_with') ||
    normalized.includes('your-saas') ||
    normalized.includes('your_saas')
  );
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

function commandExists(command) {
  try {
    const lookup = process.platform === 'win32' ? `where ${command}` : `command -v ${command}`;
    execSync(lookup, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function currentBranch() {
  const envBranch =
    normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_REF) ||
    normalizeEnvValue(process.env.GITHUB_HEAD_REF) ||
    normalizeEnvValue(process.env.GITHUB_REF_NAME) ||
    normalizeEnvValue(process.env.BRANCH_NAME) ||
    normalizeEnvValue(process.env.CI_COMMIT_BRANCH);

  if (envBranch) return envBranch;

  try {
    return gitOutput('git rev-parse --abbrev-ref HEAD');
  } catch {
    return '';
  }
}

function loadSaasEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), '.env.saas.local');
  if (!fs.existsSync(envPath)) {
    record('warn', '.env.saas.local', 'missing; create it from .env.saas.example before deploy');
    return false;
  }

  loadDotenv({ path: envPath, override: true, quiet: true });
  record('pass', '.env.saas.local', 'loaded');
  return true;
}

function readVercelProject() {
  const projectPath = path.resolve(process.cwd(), '.vercel', 'project.json');
  if (!fs.existsSync(projectPath)) return null;
  return JSON.parse(fs.readFileSync(projectPath, 'utf8'));
}

function checkGitBranch() {
  const expected = normalizeEnvValue(process.env.SAAS_ALLOWED_BRANCH) || DEFAULT_SAAS_BRANCH;
  const actual = currentBranch();
  if (actual === expected) {
    record('pass', 'Git branch', actual);
  } else {
    record('fail', 'Git branch', `expected ${expected}, got ${actual || '(unknown)'}`);
  }
}

function checkVercelProject() {
  const expectedName =
    normalizeEnvValue(process.env.SAAS_VERCEL_PROJECT_NAME) || DEFAULT_SAAS_PROJECT_NAME;
  const expectedId =
    normalizeEnvValue(process.env.SAAS_VERCEL_PROJECT_ID) || DEFAULT_SAAS_PROJECT_ID;
  const internalId =
    normalizeEnvValue(process.env.INTERNAL_VERCEL_PROJECT_ID) || DEFAULT_INTERNAL_PROJECT_ID;
  const project = readVercelProject();

  if (!project) {
    record('warn', 'Vercel link', 'missing .vercel/project.json; link the SaaS project before deploy');
    return;
  }

  if (project.projectName === expectedName && project.projectId === expectedId) {
    record('pass', 'Vercel project', `${project.projectName} (${project.projectId})`);
  } else {
    record('fail', 'Vercel project', `expected ${expectedName}/${expectedId}`);
  }

  if (project.projectId === internalId) {
    record('fail', 'Vercel project safety', 'linked to internal/live project');
  } else {
    record('pass', 'Vercel project safety', 'not linked to internal/live project');
  }
}

function checkEnvValues() {
  const required = [
    'APP_MODE',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SAAS_SUPABASE_PROJECT_ID',
    'GEMINI_API_KEY',
    'ADMIN_SESSION_SECRET',
    'CRON_SECRET',
    'SCHEMA_DRIFT_ALERT_TOKEN',
  ];

  for (const key of required) {
    if (isPlaceholder(process.env[key])) {
      record('warn', `env:${key}`, 'missing or placeholder');
    } else {
      record('pass', `env:${key}`, 'set');
    }
  }

  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  if (appMode && appMode !== 'saas') {
    record('fail', 'APP_MODE', `expected saas, got ${appMode}`);
  }

  const imageAi = normalizeEnvValue(process.env.ENABLE_IMAGE_AI).toLowerCase();
  if (!imageAi || imageAi === 'false' || imageAi === '0') {
    record('pass', 'ENABLE_IMAGE_AI', 'disabled');
  } else {
    record('fail', 'ENABLE_IMAGE_AI', 'must stay false for return AI');
  }

  const model = normalizeEnvValue(process.env.GEMINI_TEXT_MODEL).replace(/^models\//, '');
  if (!model || model === 'gemini-2.5-flash-lite') {
    record('pass', 'GEMINI_TEXT_MODEL', model || 'uses route default');
  } else {
    record('warn', 'GEMINI_TEXT_MODEL', `expected gemini-2.5-flash-lite, got ${model}`);
  }
}

function checkCommercialFoundation() {
  const requiredFiles = [
    'lib/config/saas-plans.ts',
    'lib/config/feature-flags.ts',
    'lib/auth/public-routes.ts',
    'lib/saas/org-context.ts',
    'lib/saas/subscription-access.ts',
    'lib/saas/subscription-lifecycle.ts',
    'lib/saas/team-limits.ts',
    'lib/saas/invite-policy.ts',
    'lib/saas/invite-token-data.ts',
    'lib/saas/invite-acceptance.ts',
    'lib/saas/invite-acceptance-live-data.ts',
    'lib/saas/invite-accept-route.ts',
    'lib/saas/invite-creation.ts',
    'lib/saas/return-usage-policy.ts',
    'lib/saas/platform-admin.ts',
    'lib/saas/platform-admin-roles.ts',
    'lib/saas/platform-admin-data.ts',
    'lib/saas/platform-admin-live-data.ts',
    'lib/saas/platform-admin-provisioning.ts',
    'lib/saas/platform-admin-billing-operations.ts',
    'lib/saas/billing-reconciliation.ts',
    'lib/saas/notifications.ts',
    'lib/saas/billing.ts',
    'lib/saas/settings-billing-data.ts',
    'lib/saas/settings-team-data.ts',
    'lib/saas/settings-usage-data.ts',
    'lib/saas/settings-live-data.ts',
    'lib/saas/team-invite-route.ts',
    'lib/saas/public-signup.ts',
    'lib/saas/signup-request.ts',
    'lib/saas/signup-request-repository.ts',
    'app/api/saas/signup/route.ts',
    'app/api/saas/invite/accept/route.ts',
    'app/api/saas/team/invites/route.ts',
    'app/api/billing/ecpay/webhook/route.ts',
    'scripts/saas/check-migration-plan.mjs',
    'scripts/saas/check-saas-schema-readiness.mjs',
    'scripts/saas/check-rollout-readiness.mjs',
    'app/api/internal/saas/orgs/route.ts',
    'app/api/internal/saas/orgs/[id]/route.ts',
    'app/api/internal/saas/billing/events/route.ts',
    'app/api/internal/saas/billing/operations/route.ts',
    'app/api/internal/saas/billing/events/[id]/retry/route.ts',
    'docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md',
    'supabase/migrations/023_saas_commercial_foundation.sql',
    'supabase/migrations/024_saas_commercial_v2.sql',
    'supabase/migrations/025_attach_org_id_to_business_tables.sql',
    'supabase/migrations/026_saas_public_signup_requests.sql',
    'supabase/migrations/027_saas_platform_admin_read_model.sql',
    'supabase/migrations/028_saas_manual_beta_org_provisioning.sql',
    'supabase/migrations/029_saas_billing_event_status.sql',
    'supabase/migrations/030_saas_invoice_status_alignment.sql',
    'supabase/migrations/031_saas_invite_acceptance_rpc.sql',
    'supabase/migrations/032_saas_invite_creation_rpc.sql',
    'supabase/migrations/033_saas_platform_billing_operations.sql',
    'supabase/migrations/034_saas_notification_email_queue.sql',
  ];

  for (const file of requiredFiles) {
    if (fs.existsSync(path.resolve(process.cwd(), file))) {
      record('pass', `commercial:${file}`, 'present');
    } else {
      record('fail', `commercial:${file}`, 'missing');
    }
  }

  const plansPath = path.resolve(process.cwd(), 'lib/config/saas-plans.ts');
  if (fs.existsSync(plansPath)) {
    const source = fs.readFileSync(plansPath, 'utf8');
    const expectedPlanSnippets = [
      'monthlyPriceTwd: 1490',
      'seatLimit: 3',
      'monthlyReturnSoftLimit: 500',
      'aiMonthlyLimit: 5',
      'hasAdvancedAnalytics: false',
      'hasApiAccess: false',
      'monthlyPriceTwd: 2990',
      'seatLimit: 10',
      'monthlyReturnSoftLimit: 2000',
      'aiMonthlyLimit: 30',
      'hasAdvancedAnalytics: true',
      'hasApiAccess: false',
      'monthlyPriceTwd: 7990',
      'seatLimit: 30',
      'monthlyReturnSoftLimit: 8000',
      'aiMonthlyLimit: 100',
      'hasApiAccess: true',
      'enterprise',
    ];
    const missing = expectedPlanSnippets.filter((snippet) => !source.includes(snippet));
    if (missing.length === 0) {
      record('pass', 'SaaS plans', 'approved Basic/Growth/Pro/Enterprise matrix found');
    } else {
      record('fail', 'SaaS plans', `missing baseline snippets: ${missing.join(', ')}`);
    }

    if (source.includes('getOrgAIUsageLimit') && !source.includes('APP_MODE')) {
      record('pass', 'SaaS AI quota source', 'uses org plan config, not APP_MODE');
    } else {
      record('fail', 'SaaS AI quota source', 'must derive quota from org.plan, not APP_MODE');
    }
  }

  const flagsPath = path.resolve(process.cwd(), 'lib/config/feature-flags.ts');
  if (fs.existsSync(flagsPath)) {
    const source = fs.readFileSync(flagsPath, 'utf8');
    const requiredFlags = [
      'public_signup',
      'billing',
      'subscription_plan',
      'ai_usage_limit',
      'advanced_analytics',
      'multi_tenant_admin',
      'image_ai',
    ];
    const missing = requiredFlags.filter((flag) => !source.includes(flag));
    if (missing.length === 0) {
      record('pass', 'SaaS feature flags', 'required flags found');
    } else {
      record('fail', 'SaaS feature flags', `missing flags: ${missing.join(', ')}`);
    }
  }

  const publicRoutesPath = path.resolve(process.cwd(), 'lib/auth/public-routes.ts');
  const proxyPath = path.resolve(process.cwd(), 'proxy.ts');
  if (fs.existsSync(publicRoutesPath) && fs.existsSync(proxyPath)) {
    const publicRoutesSource = fs.readFileSync(publicRoutesPath, 'utf8');
    const proxySource = fs.readFileSync(proxyPath, 'utf8');
    const requiredPublicRouteSnippets = [
      "'/'",
      "'/pricing'",
      "'/signup'",
      "'/contact'",
      "'/features'",
      "'/invite'",
      "'/legal'",
      "'/portal'",
      "'/login'",
    ];
    const missing = requiredPublicRouteSnippets.filter(
      (snippet) => !publicRoutesSource.includes(snippet)
    );
    if (missing.length === 0 && proxySource.includes('isPublicRoute(pathname)')) {
      record('pass', 'SaaS public routes', 'commercial website and portal routes stay public before login');
    } else {
      record('fail', 'SaaS public routes', `missing allowlist or proxy wiring: ${missing.join(', ')}`);
    }
  }

  const publicSignupPath = path.resolve(process.cwd(), 'lib/saas/public-signup.ts');
  const signupRequestPath = path.resolve(process.cwd(), 'lib/saas/signup-request.ts');
  const signupRepositoryPath = path.resolve(process.cwd(), 'lib/saas/signup-request-repository.ts');
  const signupPagePath = path.resolve(process.cwd(), 'app/signup/page.tsx');
  const signupApiPath = path.resolve(process.cwd(), 'app/api/saas/signup/route.ts');
  if (fs.existsSync(publicSignupPath) && fs.existsSync(signupPagePath)) {
    const publicSignupSource = fs.readFileSync(publicSignupPath, 'utf8');
    const signupPageSource = fs.readFileSync(signupPagePath, 'utf8');
    if (
      publicSignupSource.includes('resolveSaaSPublicSignupState') &&
      publicSignupSource.includes('public_signup') &&
      publicSignupSource.includes('closed_beta') &&
      signupPageSource.includes('resolveSaaSPublicSignupState')
    ) {
      record('pass', 'SaaS public signup gate', 'signup page is controlled by public_signup flag');
    } else {
      record('fail', 'SaaS public signup gate', 'signup must stay closed by default and use public_signup flag');
    }
  }

  if (
    fs.existsSync(signupRequestPath) &&
    fs.existsSync(signupRepositoryPath) &&
    fs.existsSync(signupApiPath)
  ) {
    const signupRequestSource = fs.readFileSync(signupRequestPath, 'utf8');
    const signupRepositorySource = fs.readFileSync(signupRepositoryPath, 'utf8');
    const signupApiSource = fs.readFileSync(signupApiPath, 'utf8');
    if (
      signupRequestSource.includes('submitSaaSPublicSignupRequest') &&
      signupRequestSource.includes('feature_disabled') &&
      signupRequestSource.includes('not_configured') &&
      signupRequestSource.includes("plan: 'basic'") &&
      signupRepositorySource.includes('createDefaultSaaSPublicSignupRequestRepository') &&
      signupRepositorySource.includes('createUntypedAdminClient') &&
      signupRepositorySource.includes('signup_requests') &&
      signupApiSource.includes('handleSaaSPublicSignupRequest') &&
      signupApiSource.includes('submitSaaSPublicSignupRequest') &&
      signupApiSource.includes('createDefaultSaaSPublicSignupRequestRepository')
    ) {
      record('pass', 'SaaS public signup API', 'API route is flag-gated and persistence is wired behind the disabled-by-default flag');
    } else {
      record('fail', 'SaaS public signup API', 'signup API must be flag-gated, Basic-only, and persist to signup_requests only after the flag is enabled');
    }
  }

  const orgContextPath = path.resolve(process.cwd(), 'lib/saas/org-context.ts');
  if (fs.existsSync(orgContextPath)) {
    const source = fs.readFileSync(orgContextPath, 'utf8');
    if (
      source.includes('getOrgContext') &&
      source.includes('organization_members') &&
      source.includes('resolveSaaSFeatureFlags') &&
      !source.includes('createAdminClient') &&
      !source.includes('createUntypedAdminClient')
    ) {
      record('pass', 'SaaS org context', 'auth user -> organization -> plan -> feature flags guard found');
    } else {
      record('fail', 'SaaS org context', 'must resolve org context without service-role membership lookup');
    }
  }

  const subscriptionAccessPath = path.resolve(process.cwd(), 'lib/saas/subscription-access.ts');
  if (fs.existsSync(subscriptionAccessPath) && fs.existsSync(orgContextPath)) {
    const accessSource = fs.readFileSync(subscriptionAccessPath, 'utf8');
    const orgContextSource = fs.readFileSync(orgContextPath, 'utf8');
    const exportRoutePaths = [
      'app/api/v1/admin/returns/export/route.ts',
      'app/api/v1/admin/shopee-returns/export/route.ts',
      'app/api/v1/admin/pickup/export/route.ts',
    ];
    const exportRoutesAreGuarded = exportRoutePaths.every((routePath) => {
      const fullPath = path.resolve(process.cwd(), routePath);
      return (
        fs.existsSync(fullPath) &&
        fs.readFileSync(fullPath, 'utf8').includes('exportable: true')
      );
    });
    if (
      accessSource.includes('SAAS_SUBSCRIPTION_ACCESS_POLICIES') &&
      accessSource.includes('past_due') &&
      accessSource.includes('canCreateData: false') &&
      accessSource.includes('canUseAI: false') &&
      accessSource.includes('canExport: false') &&
      orgContextSource.includes('canCreateSaaSData(context.orgStatus)') &&
      orgContextSource.includes('canExportSaaSData(context.orgStatus)') &&
      exportRoutesAreGuarded
    ) {
      record('pass', 'SaaS subscription access policy', 'past_due and inactive statuses are read-only for write and export guards');
    } else {
      record('fail', 'SaaS subscription access policy', 'must keep past_due, suspended, and cancelled from write/AI/export paths');
    }
  }

  const subscriptionLifecyclePath = path.resolve(process.cwd(), 'lib/saas/subscription-lifecycle.ts');
  if (fs.existsSync(subscriptionLifecyclePath)) {
    const source = fs.readFileSync(subscriptionLifecyclePath, 'utf8');
    if (
      source.includes('PAST_DUE_GRACE_DAYS = 7') &&
      source.includes('SUSPENDED_RETENTION_DAYS = 30') &&
      source.includes('resolveSaaSSubscriptionTimedStatus') &&
      source.includes('trial_expired') &&
      source.includes('cancelled_at_period_end') &&
      source.includes('past_due_grace_expired') &&
      source.includes('suspended_retention_expired')
    ) {
      record('pass', 'SaaS subscription lifecycle timing', 'trial, past_due, suspended, and cancel-at-period-end timing rules are defined');
    } else {
      record('fail', 'SaaS subscription lifecycle timing', 'must define trial_end expiry, 7-day past_due grace, 30-day suspended retention, and cancel-at-period-end rules');
    }
  }

  const saasSchemaGatePath = path.resolve(process.cwd(), 'scripts/saas/check-saas-schema-readiness.mjs');
  if (fs.existsSync(saasSchemaGatePath)) {
    const source = fs.readFileSync(saasSchemaGatePath, 'utf8');
    if (
      source.includes('SAAS_SCHEMA_GATE_STRICT') &&
      source.includes('signup_requests') &&
      source.includes('billing_events') &&
      source.includes('organization_members') &&
      source.includes('upgrade_suggested_at') &&
      source.includes('current_period_end') &&
      source.includes('invoice_carrier') &&
      source.includes('org_id')
    ) {
      record('pass', 'SaaS schema readiness gate', 'checks tenant, signup, billing, platform-admin, and commercial v2 schema before live wiring');
    } else {
      record('fail', 'SaaS schema readiness gate', 'must check SaaS tenant, signup, billing, platform-admin, and commercial v2 schema');
    }
  }

  const saasMigrationPlanPath = path.resolve(process.cwd(), 'scripts/saas/check-migration-plan.mjs');
  if (fs.existsSync(saasMigrationPlanPath)) {
    const source = fs.readFileSync(saasMigrationPlanPath, 'utf8');
    if (
      source.includes('SUPABASE_DB_PASSWORD') &&
      source.includes('DEFAULT_FORBIDDEN_SUPABASE_REFS') &&
      source.includes('REQUIRED_SAAS_MIGRATIONS') &&
      source.includes('034_saas_notification_email_queue.sql') &&
      source.includes('No migrations were applied by this check')
    ) {
      record('pass', 'SaaS migration plan check', 'validates target ref, DB password, and full 001-034 migration chain before apply');
    } else {
      record('fail', 'SaaS migration plan check', 'must validate SaaS target, DB password, and full 001-034 migration chain without applying migrations');
    }
  }

  const saasRolloutCheckPath = path.resolve(process.cwd(), 'scripts/saas/check-rollout-readiness.mjs');
  if (fs.existsSync(saasRolloutCheckPath)) {
    const source = fs.readFileSync(saasRolloutCheckPath, 'utf8');
    if (
      source.includes('GEMINI_API_KEY') &&
      source.includes('NEXT_PUBLIC_APP_URL') &&
      source.includes('BILLING_PROVIDER') &&
      source.includes('ENABLE_AI_USAGE_LIMIT') &&
      source.includes('DEFAULT_FORBIDDEN_SUPABASE_REFS') &&
      source.includes('No external changes were made by this check')
    ) {
      record('pass', 'SaaS rollout readiness check', 'checks final Gemini, app URL, billing, AI safety, and SaaS project blockers without external changes');
    } else {
      record('fail', 'SaaS rollout readiness check', 'must validate final rollout blockers without mutating env, DB, deploy, or platform state');
    }
  }

  const uiBackendContractsPath = path.resolve(process.cwd(), 'lib/saas/ui-backend-contracts.ts');
  const settingsBillingDataPath = path.resolve(process.cwd(), 'lib/saas/settings-billing-data.ts');
  const settingsTeamDataPath = path.resolve(process.cwd(), 'lib/saas/settings-team-data.ts');
  const settingsUsageDataPath = path.resolve(process.cwd(), 'lib/saas/settings-usage-data.ts');
  const settingsLiveDataPath = path.resolve(process.cwd(), 'lib/saas/settings-live-data.ts');
  if (fs.existsSync(uiBackendContractsPath)) {
    const source = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      source.includes('buildUsageSettingsView') &&
      source.includes('UsageSettingsViewInput') &&
      source.includes('buildBillingSettingsView') &&
      source.includes('BillingSettingsViewInput') &&
      source.includes('buildTeamSettingsView') &&
      source.includes('TeamSettingsViewInput') &&
      source.includes('buildPlatformOrganizationListView') &&
      source.includes('buildPlatformOrganizationDetailView') &&
      source.includes('buildPlatformBillingEventsView')
    ) {
      record('pass', 'SaaS UI/backend DTO builders', 'settings and platform admin contracts have validated DTO builders');
    } else {
      record('fail', 'SaaS UI/backend DTO builders', 'UI contracts must have validation builders before live backend wiring');
    }
  }

  if (fs.existsSync(settingsBillingDataPath) && fs.existsSync(uiBackendContractsPath)) {
    const dataSource = fs.readFileSync(settingsBillingDataPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      dataSource.includes('createSettingsBillingDataRepository') &&
      dataSource.includes('buildBillingSettingsViewInput') &&
      dataSource.includes("from('organizations')") &&
      dataSource.includes("from('subscriptions')") &&
      dataSource.includes("from('invoices')") &&
      uiContractSource.includes('BillingSettingsViewInput')
    ) {
      record('pass', 'SaaS settings billing data repository', 'billing settings live-data input builder is present without exposing a route');
    } else {
      record('fail', 'SaaS settings billing data repository', 'billing settings live-data wiring must use the repository and DTO input builder before exposing routes');
    }
  }

  if (fs.existsSync(settingsTeamDataPath) && fs.existsSync(uiBackendContractsPath)) {
    const dataSource = fs.readFileSync(settingsTeamDataPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      dataSource.includes('createSettingsTeamDataRepository') &&
      dataSource.includes('buildTeamSettingsViewInput') &&
      dataSource.includes("from('organizations')") &&
      dataSource.includes("from('organization_members')") &&
      dataSource.includes("from('organization_invites')") &&
      dataSource.includes('resolveSaaSInviteStatus') &&
      uiContractSource.includes('TeamSettingsViewInput')
    ) {
      record('pass', 'SaaS settings team data repository', 'team settings live-data input builder is present without exposing a route');
    } else {
      record('fail', 'SaaS settings team data repository', 'team settings live-data wiring must use the repository and DTO input builder before exposing routes');
    }
  }

  if (fs.existsSync(settingsUsageDataPath) && fs.existsSync(uiBackendContractsPath)) {
    const dataSource = fs.readFileSync(settingsUsageDataPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      dataSource.includes('createSettingsUsageDataRepository') &&
      dataSource.includes('buildUsageSettingsViewInput') &&
      dataSource.includes("from('organizations')") &&
      dataSource.includes("from('organization_members')") &&
      dataSource.includes("from('organization_invites')") &&
      dataSource.includes("from('return_requests')") &&
      dataSource.includes("from('ai_usage_events')") &&
      dataSource.includes('RETURN_AI_ANALYSIS_FEATURE') &&
      dataSource.includes('resolveSaaSInviteStatus') &&
      uiContractSource.includes('UsageSettingsViewInput')
    ) {
      record('pass', 'SaaS settings usage data repository', 'usage settings live-data input builder is present without exposing a route');
    } else {
      record('fail', 'SaaS settings usage data repository', 'usage settings live-data wiring must use the repository and DTO input builder before exposing routes');
    }
  }

  if (fs.existsSync(settingsLiveDataPath)) {
    const source = fs.readFileSync(settingsLiveDataPath, 'utf8');
    if (
      source.includes('loadBillingSettingsView') &&
      source.includes('loadUsageSettingsView') &&
      source.includes('loadTeamSettingsView') &&
      source.includes('getOrgContext') &&
      source.includes('createClient') &&
      source.includes('buildBillingSettingsView') &&
      source.includes('buildUsageSettingsView') &&
      source.includes('buildTeamSettingsView') &&
      source.includes('SettingsLiveDataResult') &&
      !source.includes('createUntypedAdminClient') &&
      !source.includes('createAdminClient')
    ) {
      record('pass', 'SaaS settings live data loaders', 'server settings loaders compose org context, RLS client, repositories, and UI DTO builders without mock data');
    } else {
      record('fail', 'SaaS settings live data loaders', 'settings loaders must use org context, server Supabase client, repositories, and DTO builders without service-role defaults');
    }
  }

  const teamLimitsPath = path.resolve(process.cwd(), 'lib/saas/team-limits.ts');
  const invitePolicyPath = path.resolve(process.cwd(), 'lib/saas/invite-policy.ts');
  const inviteTokenDataPath = path.resolve(process.cwd(), 'lib/saas/invite-token-data.ts');
  const inviteAcceptancePath = path.resolve(process.cwd(), 'lib/saas/invite-acceptance.ts');
  const inviteAcceptanceLiveDataPath = path.resolve(
    process.cwd(),
    'lib/saas/invite-acceptance-live-data.ts'
  );
  const inviteAcceptRouteServicePath = path.resolve(
    process.cwd(),
    'lib/saas/invite-accept-route.ts'
  );
  const inviteCreationPath = path.resolve(process.cwd(), 'lib/saas/invite-creation.ts');
  const teamInviteRoutePath = path.resolve(process.cwd(), 'lib/saas/team-invite-route.ts');
  if (fs.existsSync(invitePolicyPath)) {
    const source = fs.readFileSync(invitePolicyPath, 'utf8');
    if (
      source.includes('resolveSaaSInviteStatus') &&
      source.includes('canAcceptSaaSInvite') &&
      source.includes("'pending' | 'accepted' | 'expired' | 'revoked'") &&
      source.includes("'admin' | 'staff' | 'viewer'")
    ) {
      record('pass', 'SaaS invite status policy', 'invite status and acceptability rules are centralized before live invite routes');
    } else {
      record('fail', 'SaaS invite status policy', 'invite pending/accepted/expired/revoked and role rules must be centralized before live invite routes');
    }
  }

  if (fs.existsSync(inviteTokenDataPath)) {
    const source = fs.readFileSync(inviteTokenDataPath, 'utf8');
    if (
      source.includes('createInviteTokenDataRepository') &&
      source.includes('getInviteByToken') &&
      source.includes("from('organization_invites')") &&
      source.includes(".eq('token', token)") &&
      source.includes('organizations(id, name, slug, plan, status)') &&
      source.includes('resolveSaaSInviteStatus') &&
      source.includes('canAcceptSaaSInvite')
    ) {
      record('pass', 'SaaS invite token data repository', 'invite token live-data lookup is present without exposing a route');
    } else {
      record('fail', 'SaaS invite token data repository', 'invite token lookup must use organization_invites, organization context, and shared invite policy before exposing routes');
    }
  }

  if (fs.existsSync(inviteAcceptancePath)) {
    const source = fs.readFileSync(inviteAcceptancePath, 'utf8');
    if (
      source.includes('acceptSaaSInvite') &&
      source.includes('createSaaSInviteAcceptanceRepository') &&
      source.includes('SaaSInviteAcceptanceRepository') &&
      source.includes('getInviteByToken') &&
      source.includes('acceptInvite') &&
      source.includes('accept_organization_invite') &&
      source.includes('email_mismatch') &&
      source.includes('invite_expired') &&
      source.includes('invite_already_accepted') &&
      source.includes('invite_revoked') &&
      !source.includes('createUntypedAdminClient') &&
      !source.includes('createAdminClient')
    ) {
      record('pass', 'SaaS invite acceptance service', 'invite acceptance use-case is centralized behind repository interfaces without exposing a route');
    } else {
      record('fail', 'SaaS invite acceptance service', 'invite acceptance must validate token/email/status and stay repository-backed before exposing routes');
    }
  }

  if (fs.existsSync(inviteAcceptanceLiveDataPath)) {
    const source = fs.readFileSync(inviteAcceptanceLiveDataPath, 'utf8');
    if (
      source.includes('loadInviteAcceptanceView') &&
      source.includes('InviteAcceptanceLiveDataResult') &&
      source.includes('InviteAcceptanceViewerState') &&
      source.includes('createInviteTokenDataRepository') &&
      source.includes('createInviteAcceptanceMembershipRepository') &&
      source.includes('requireRouteAuth') &&
      source.includes('can_accept') &&
      source.includes('needs_login') &&
      source.includes('email_mismatch') &&
      source.includes('already_member') &&
      source.includes("state: 'ready'") &&
      source.includes("state: 'empty'") &&
      source.includes("state: 'error'")
    ) {
      record('pass', 'SaaS invite acceptance live data loader', 'invite page loader returns ready/empty/error states with viewer acceptance state and organization context');
    } else {
      record('fail', 'SaaS invite acceptance live data loader', 'invite page loader must use invite token data, auth context, membership check, and four-state UI results');
    }
  }

  if (fs.existsSync(inviteCreationPath)) {
    const source = fs.readFileSync(inviteCreationPath, 'utf8');
    if (
      source.includes('createSaaSInvite') &&
      source.includes('createSaaSInviteCreationRepository') &&
      source.includes('generateSaaSInviteToken') &&
      source.includes('create_organization_invite') &&
      source.includes('canInviteSaaSTeamMember') &&
      source.includes('seat_limit_reached') &&
      source.includes('buildCreateOrganizationInviteRpcArgs') &&
      !source.includes('createUntypedAdminClient') &&
      !source.includes('createAdminClient')
    ) {
      record('pass', 'SaaS invite creation service', 'invite creation use-case validates role, seat limit, token, and RPC args without exposing a route');
    } else {
      record('fail', 'SaaS invite creation service', 'invite creation must validate role/seat limits and stay repository-backed before exposing routes');
    }
  }

  if (fs.existsSync(teamInviteRoutePath)) {
    const source = fs.readFileSync(teamInviteRoutePath, 'utf8');
    const routePath = path.resolve(process.cwd(), 'app/api/saas/team/invites/route.ts');
    const routeSource = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';
    if (
      source.includes('createSaaSTeamInviteFromRequest') &&
      source.includes('getOrgContext') &&
      source.includes("roles: ['owner', 'admin']") &&
      source.includes('writable: true') &&
      source.includes('createSettingsTeamDataRepository') &&
      source.includes('createSaaSInvite') &&
      source.includes('createSaaSInviteCreationRepository') &&
      routeSource.includes('handleCreateSaaSTeamInviteRequest') &&
      routeSource.includes('SaaSOrgContextError') &&
      routeSource.includes('SaaSInviteCreationError')
    ) {
      record('pass', 'SaaS team invite API foundation', 'team invite route is owner/admin gated and reuses seat-limited invite creation service');
    } else {
      record('fail', 'SaaS team invite API foundation', 'team invite route must require org context, owner/admin role, writable status, seat counts, and invite creation service');
    }
  }

  if (fs.existsSync(inviteAcceptRouteServicePath)) {
    const source = fs.readFileSync(inviteAcceptRouteServicePath, 'utf8');
    const routePath = path.resolve(process.cwd(), 'app/api/saas/invite/accept/route.ts');
    const routeSource = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';
    if (
      source.includes('acceptSaaSInviteFromRequest') &&
      source.includes('requireRouteAuth') &&
      source.includes('userEmail') &&
      source.includes('createSaaSInviteAcceptanceRepository') &&
      source.includes('createInviteTokenDataRepository') &&
      source.includes('createUntypedAdminClient') &&
      routeSource.includes('handleAcceptSaaSInviteRequest') &&
      routeSource.includes('SaaSInviteAcceptRouteError') &&
      routeSource.includes('SaaSInviteAcceptanceError') &&
      routeSource.includes('export async function POST')
    ) {
      record('pass', 'SaaS invite accept API foundation', 'invite accept route requires auth email and reuses the invite acceptance service/RPC wrapper');
    } else {
      record('fail', 'SaaS invite accept API foundation', 'invite accept route must require signed-in email, reuse invite acceptance service, and expose stable JSON errors');
    }
  }

  if (fs.existsSync(teamLimitsPath) && fs.existsSync(uiBackendContractsPath)) {
    const teamLimitsSource = fs.readFileSync(teamLimitsPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      teamLimitsSource.includes('resolveSaaSTeamSeatUsage') &&
      teamLimitsSource.includes('pendingInviteCount') &&
      teamLimitsSource.includes('reservedSeatCount') &&
      uiContractSource.includes('resolveSaaSTeamSeatUsage') &&
      uiContractSource.includes('Seat limit has been reached for this plan.')
    ) {
      record('pass', 'SaaS team seat limits', 'team DTOs account for active seats and pending invites before enabling invites');
    } else {
      record('fail', 'SaaS team seat limits', 'team invite DTOs must enforce org.plan seat limits');
    }
  }

  const returnUsagePolicyPath = path.resolve(
    process.cwd(),
    'lib/saas/return-usage-policy.ts'
  );
  if (fs.existsSync(returnUsagePolicyPath) && fs.existsSync(uiBackendContractsPath)) {
    const policySource = fs.readFileSync(returnUsagePolicyPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      policySource.includes('resolveSaaSReturnUsagePolicy') &&
      policySource.includes('shouldBlockOperations: false') &&
      policySource.includes('resolveSaaSReturnUpgradeSuggestion') &&
      policySource.includes('consecutive_overage') &&
      uiContractSource.includes('resolveSaaSReturnUsagePolicy') &&
      uiContractSource.includes('plan soft limit')
    ) {
      record('pass', 'SaaS return usage soft limits', 'return volume warnings are centralized and remain non-blocking');
    } else {
      record('fail', 'SaaS return usage soft limits', 'return soft limits must warn at 80/100 percent, never block operations, and support consecutive overage suggestions');
    }
  }

  const platformAdminPath = path.resolve(process.cwd(), 'lib/saas/platform-admin.ts');
  const platformAdminRolesPath = path.resolve(process.cwd(), 'lib/saas/platform-admin-roles.ts');
  if (fs.existsSync(platformAdminPath) && fs.existsSync(platformAdminRolesPath)) {
    const source = fs.readFileSync(platformAdminPath, 'utf8');
    const rolesSource = fs.readFileSync(platformAdminRolesPath, 'utf8');
    if (
      source.includes('requirePlatformAdminAccess') &&
      source.includes('requireRouteAuth({ requireAdmin: true })') &&
      source.includes('requiredPermission') &&
      source.includes('resolvePlatformAdminRole') &&
      source.includes('permission_denied') &&
      source.includes('multi_tenant_admin') &&
      rolesSource.includes("export type PlatformAdminRole = 'owner' | 'support' | 'billing'") &&
      rolesSource.includes('PLATFORM_ADMIN_ROLE_PERMISSIONS') &&
      rolesSource.includes('manage_billing_operations') &&
      rolesSource.includes('provision_organizations') &&
      !source.includes('createAdminClient') &&
      !source.includes('createUntypedAdminClient')
    ) {
      record('pass', 'SaaS platform admin guard', 'admin auth, feature flag, and owner/support/billing role permission gate found');
    } else {
      record('fail', 'SaaS platform admin guard', 'must require admin auth, multi_tenant_admin flag, and platform role permissions without direct service-role access');
    }
  }

  const platformAdminDataPath = path.resolve(process.cwd(), 'lib/saas/platform-admin-data.ts');
  const platformAdminLiveDataPath = path.resolve(process.cwd(), 'lib/saas/platform-admin-live-data.ts');
  const platformOrgRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/orgs/route.ts');
  const platformOrgDetailRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/orgs/[id]/route.ts');
  const platformBillingEventsRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/billing/events/route.ts');
  const platformBillingOperationsRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/billing/operations/route.ts');
  if (
    fs.existsSync(platformAdminDataPath) &&
    fs.existsSync(platformOrgRoutePath) &&
    fs.existsSync(platformOrgDetailRoutePath) &&
    fs.existsSync(platformBillingEventsRoutePath) &&
    fs.existsSync(platformBillingOperationsRoutePath)
  ) {
    const dataSource = fs.readFileSync(platformAdminDataPath, 'utf8');
    const orgRouteSource = fs.readFileSync(platformOrgRoutePath, 'utf8');
    const orgDetailRouteSource = fs.readFileSync(platformOrgDetailRoutePath, 'utf8');
    const billingRouteSource = fs.readFileSync(platformBillingEventsRoutePath, 'utf8');
    const billingOperationsRouteSource = fs.readFileSync(platformBillingOperationsRoutePath, 'utf8');
    const routesUseGuard = [orgRouteSource, orgDetailRouteSource, billingRouteSource, billingOperationsRouteSource].every((source) =>
      source.includes('requirePlatformAdminAccess') &&
      source.includes('createUntypedAdminClient')
    );
    const dataLayerHasRepository =
      dataSource.includes('createPlatformAdminDataRepository') &&
      dataSource.includes('PlatformAdminDataRepository');
    const orgRouteHasProvisioning =
      orgRouteSource.includes('handleCreateManualBetaOrganization') &&
      orgRouteSource.includes('createPlatformOrgProvisioningRepository') &&
      orgRouteSource.includes("requiredPermission: 'provision_organizations'") &&
      orgRouteSource.includes('export async function POST');
    const billingRouteHasOperations =
      billingOperationsRouteSource.includes('handlePlatformBillingOperation') &&
      billingOperationsRouteSource.includes('createPlatformBillingOperationsRepository') &&
      billingOperationsRouteSource.includes("requiredPermission: 'manage_billing_operations'") &&
      billingOperationsRouteSource.includes('export async function POST');
    const readRoutesHavePermissions =
      orgRouteSource.includes("requiredPermission: 'view_organizations'") &&
      orgDetailRouteSource.includes("requiredPermission: 'view_organizations'") &&
      billingRouteSource.includes("requiredPermission: 'view_billing_events'");
    if (routesUseGuard && dataLayerHasRepository && orgRouteHasProvisioning && billingRouteHasOperations && readRoutesHavePermissions) {
      record('pass', 'SaaS platform admin API routes', 'internal org and billing routes are guard-gated with platform role permissions');
    } else {
      record('fail', 'SaaS platform admin API routes', 'internal SaaS API routes must use platform admin guard, repository layer, and owner/support/billing permission gates');
    }
  }

  if (fs.existsSync(platformAdminLiveDataPath)) {
    const source = fs.readFileSync(platformAdminLiveDataPath, 'utf8');
    if (
      source.includes('loadPlatformOrganizationsView') &&
      source.includes('loadPlatformOrganizationDetailView') &&
      source.includes('loadPlatformBillingEventsView') &&
      source.includes('PlatformAdminLiveDataResult') &&
      source.includes('requirePlatformAdminAccess') &&
      source.includes('PlatformAdminAccessError') &&
      source.includes("loadAccess(options, 'view_organizations')") &&
      source.includes("loadAccess(options, 'view_billing_events')") &&
      source.includes('createPlatformAdminDataRepository') &&
      source.includes('createUntypedAdminClient') &&
      source.includes('buildPlatformOrganizationListView') &&
      source.includes('buildPlatformOrganizationDetailView') &&
      source.includes('buildPlatformBillingEventsView') &&
      source.includes("state: 'gated'") &&
      source.includes("state: 'empty'") &&
      !source.includes("from '@/app/api/internal")
    ) {
      record('pass', 'SaaS platform admin live data loaders', 'internal page loaders are platform-admin gated and return DTO ready/empty/gated/error states without calling route handlers');
    } else {
      record('fail', 'SaaS platform admin live data loaders', 'platform admin page loaders must use the guard, repository layer, DTO builders, and four-state results without route-handler coupling');
    }
  }

  const billingFoundationPath = path.resolve(process.cwd(), 'lib/saas/billing.ts');
  const billingReconciliationPath = path.resolve(process.cwd(), 'lib/saas/billing-reconciliation.ts');
  const ecpayWebhookRoutePath = path.resolve(process.cwd(), 'app/api/billing/ecpay/webhook/route.ts');
  const billingRetryRoutePath = path.resolve(
    process.cwd(),
    'app/api/internal/saas/billing/events/[id]/retry/route.ts'
  );
  const billingRetrySopPath = path.resolve(
    process.cwd(),
    'docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md'
  );
  if (fs.existsSync(billingFoundationPath) && fs.existsSync(ecpayWebhookRoutePath)) {
    const billingSource = fs.readFileSync(billingFoundationPath, 'utf8');
    const ecpayRouteSource = fs.readFileSync(ecpayWebhookRoutePath, 'utf8');
    if (
      billingSource.includes('resolveBillingWebhookState') &&
      billingSource.includes('createBillingEventsRepository') &&
      billingSource.includes('buildECPayCheckMacValue') &&
      billingSource.includes('verifyECPayCheckMacValue') &&
      billingSource.includes('provider_event_id') &&
      billingSource.includes("status: input.status ?? 'received'") &&
      ecpayRouteSource.includes('billing_disabled') &&
      ecpayRouteSource.includes('credentials_missing') &&
      ecpayRouteSource.includes('signature_required') &&
      ecpayRouteSource.includes('verifyECPayCheckMacValue')
    ) {
      record('pass', 'SaaS billing webhook foundation', 'ECPay route is disabled by flag and verifies CheckMacValue before recording events');
    } else {
      record('fail', 'SaaS billing webhook foundation', 'billing webhook must be flag-gated, credential-gated, and CheckMacValue-gated');
    }
  }

  if (
    fs.existsSync(billingReconciliationPath) &&
    fs.existsSync(billingRetryRoutePath) &&
    fs.existsSync(billingRetrySopPath)
  ) {
    const reconciliationSource = fs.readFileSync(billingReconciliationPath, 'utf8');
    const retryRouteSource = fs.readFileSync(billingRetryRoutePath, 'utf8');
    const sopSource = fs.readFileSync(billingRetrySopPath, 'utf8');
    if (
      reconciliationSource.includes('buildBillingEventRetryDecision') &&
      reconciliationSource.includes('buildBillingEventReconciliationView') &&
      reconciliationSource.includes('provider_replay_not_enabled') &&
      retryRouteSource.includes('handleDryRunPlatformBillingEventRetry') &&
      retryRouteSource.includes('requirePlatformAdminAccess') &&
      retryRouteSource.includes('retry_not_enabled') &&
      retryRouteSource.includes('buildBillingEventRetryDecision') &&
      sopSource.includes('Provider replay is disabled by default') &&
      sopSource.includes('Go/No-Go For UI Retry')
    ) {
      record('pass', 'SaaS billing retry and reconciliation', 'dry-run retry eligibility and reconciliation SOP exist without enabling provider replay');
    } else {
      record('fail', 'SaaS billing retry and reconciliation', 'must keep retry dry-run only and document reconciliation before UI retry is enabled');
    }
  }

  const notificationsPath = path.resolve(process.cwd(), 'lib/saas/notifications.ts');
  const notificationMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/034_saas_notification_email_queue.sql'
  );
  if (fs.existsSync(notificationsPath) && fs.existsSync(notificationMigrationPath)) {
    const notificationsSource = fs.readFileSync(notificationsPath, 'utf8');
    const migrationSource = fs.readFileSync(notificationMigrationPath, 'utf8');
    if (
      notificationsSource.includes('buildBillingPaymentFailedNotification') &&
      notificationsSource.includes('buildAIQuotaReachedNotification') &&
      notificationsSource.includes('buildTrialEndingNotification') &&
      notificationsSource.includes('buildPlatformAnnouncementNotification') &&
      notificationsSource.includes('createSaaSNotificationQueueRepository') &&
      notificationsSource.includes("'notifications'") &&
      notificationsSource.includes("'email_queue'") &&
      !notificationsSource.includes('nodemailer') &&
      !notificationsSource.includes('sendgrid') &&
      !notificationsSource.includes('resend') &&
      migrationSource.includes('CREATE TABLE IF NOT EXISTS public.email_queue') &&
      migrationSource.includes('ALTER TABLE public.notifications') &&
      migrationSource.includes("'billing.payment_failed'") &&
      migrationSource.includes("'usage.ai_quota_reached'") &&
      migrationSource.includes("'trial.ending'") &&
      migrationSource.includes("'platform.announcement'") &&
      migrationSource.includes('service-role only')
    ) {
      record('pass', 'SaaS notification queue foundation', 'billing, AI quota, trial, and announcement events enqueue records without sending email');
    } else {
      record('fail', 'SaaS notification queue foundation', 'notification backend must create notifications/email_queue contracts without wiring an email provider');
    }
  }

  const platformAdminReadModelMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/027_saas_platform_admin_read_model.sql'
  );
  if (
    fs.existsSync(platformAdminReadModelMigrationPath) &&
    fs.existsSync(platformAdminDataPath)
  ) {
    const migrationSource = fs.readFileSync(platformAdminReadModelMigrationPath, 'utf8');
    const dataSource = fs.readFileSync(platformAdminDataPath, 'utf8');
    if (
      migrationSource.includes('owner_email') &&
      migrationSource.includes('member_count') &&
      migrationSource.includes('refresh_organization_member_count') &&
      dataSource.includes('owner_email') &&
      dataSource.includes('member_count')
    ) {
      record('pass', 'SaaS platform admin read model', 'migration draft matches platform admin API read columns');
    } else {
      record('fail', 'SaaS platform admin read model', 'platform admin API read columns must be represented in migration drafts');
    }
  }

  const platformOrgProvisioningPath = path.resolve(
    process.cwd(),
    'lib/saas/platform-admin-provisioning.ts'
  );
  const manualBetaProvisioningMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/028_saas_manual_beta_org_provisioning.sql'
  );
  const billingEventStatusMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/029_saas_billing_event_status.sql'
  );
  if (
    fs.existsSync(platformOrgProvisioningPath) &&
    fs.existsSync(manualBetaProvisioningMigrationPath)
  ) {
    const provisioningSource = fs.readFileSync(platformOrgProvisioningPath, 'utf8');
    const migrationSource = fs.readFileSync(manualBetaProvisioningMigrationPath, 'utf8');
    if (
      provisioningSource.includes('createPlatformOrgProvisioningRepository') &&
      provisioningSource.includes('create_manual_beta_organization') &&
      migrationSource.includes('CREATE OR REPLACE FUNCTION public.create_manual_beta_organization') &&
      migrationSource.includes('platform.manual_beta_org_created') &&
      migrationSource.includes('GRANT EXECUTE')
    ) {
      record('pass', 'SaaS manual Beta org provisioning', 'platform admin POST route has RPC-backed provisioning draft');
    } else {
      record('fail', 'SaaS manual Beta org provisioning', 'manual Beta org provisioning must be platform-admin gated and backed by a migration draft');
    }
  }

  if (fs.existsSync(billingEventStatusMigrationPath) && fs.existsSync(billingFoundationPath)) {
    const migrationSource = fs.readFileSync(billingEventStatusMigrationPath, 'utf8');
    const billingSource = fs.readFileSync(billingFoundationPath, 'utf8');
    if (
      migrationSource.includes('ADD COLUMN IF NOT EXISTS status') &&
      migrationSource.includes("'received', 'processed', 'failed', 'ignored'") &&
      billingSource.includes("status: input.status ?? 'received'")
    ) {
      record('pass', 'SaaS billing event status schema', 'billing_events.status draft matches backend record defaults');
    } else {
      record('fail', 'SaaS billing event status schema', 'billing_events.status must support received/processed/failed/ignored and backend defaults');
    }
  }

  const invoiceStatusMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/030_saas_invoice_status_alignment.sql'
  );
  const inviteAcceptanceMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/031_saas_invite_acceptance_rpc.sql'
  );
  const inviteCreationMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/032_saas_invite_creation_rpc.sql'
  );
  const platformBillingOperationsPath = path.resolve(
    process.cwd(),
    'lib/saas/platform-admin-billing-operations.ts'
  );
  const platformBillingOperationsMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/033_saas_platform_billing_operations.sql'
  );
  if (fs.existsSync(invoiceStatusMigrationPath) && fs.existsSync(uiBackendContractsPath)) {
    const migrationSource = fs.readFileSync(invoiceStatusMigrationPath, 'utf8');
    const uiContractSource = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      migrationSource.includes('invoices_status_check') &&
      migrationSource.includes("'draft', 'issued', 'paid', 'failed', 'void'") &&
      uiContractSource.includes("'draft' | 'issued' | 'paid' | 'failed' | 'void'")
    ) {
      record('pass', 'SaaS invoice status schema', 'invoice status draft matches backend billing settings contract');
    } else {
      record('fail', 'SaaS invoice status schema', 'invoice status must align between migration drafts and billing settings DTOs');
    }
  }

  if (fs.existsSync(inviteAcceptanceMigrationPath) && fs.existsSync(inviteAcceptancePath)) {
    const migrationSource = fs.readFileSync(inviteAcceptanceMigrationPath, 'utf8');
    const inviteAcceptanceSource = fs.readFileSync(inviteAcceptancePath, 'utf8');
    if (
      migrationSource.includes('CREATE OR REPLACE FUNCTION public.accept_organization_invite') &&
      migrationSource.includes('FOR UPDATE') &&
      migrationSource.includes('member.invite_accepted') &&
      migrationSource.includes('GRANT EXECUTE') &&
      inviteAcceptanceSource.includes('accept_organization_invite') &&
      inviteAcceptanceSource.includes('buildAcceptOrganizationInviteRpcArgs')
    ) {
      record('pass', 'SaaS invite acceptance RPC draft', 'invite acceptance RPC draft matches the repository wrapper');
    } else {
      record('fail', 'SaaS invite acceptance RPC draft', 'invite acceptance must have an atomic RPC draft and matching repository wrapper');
    }
  }

  if (fs.existsSync(inviteCreationMigrationPath) && fs.existsSync(inviteCreationPath)) {
    const migrationSource = fs.readFileSync(inviteCreationMigrationPath, 'utf8');
    const inviteCreationSource = fs.readFileSync(inviteCreationPath, 'utf8');
    if (
      migrationSource.includes('CREATE OR REPLACE FUNCTION public.create_organization_invite') &&
      migrationSource.includes('ON CONFLICT (org_id, email)') &&
      migrationSource.includes('member.invited') &&
      migrationSource.includes('GRANT EXECUTE') &&
      inviteCreationSource.includes('create_organization_invite') &&
      inviteCreationSource.includes('buildCreateOrganizationInviteRpcArgs')
    ) {
      record('pass', 'SaaS invite creation RPC draft', 'invite creation RPC draft matches the repository wrapper');
    } else {
      record('fail', 'SaaS invite creation RPC draft', 'invite creation must have an atomic RPC draft and matching repository wrapper');
    }
  }

  if (
    fs.existsSync(platformBillingOperationsMigrationPath) &&
    fs.existsSync(platformBillingOperationsPath)
  ) {
    const migrationSource = fs.readFileSync(platformBillingOperationsMigrationPath, 'utf8');
    const billingOperationsSource = fs.readFileSync(platformBillingOperationsPath, 'utf8');
    if (
      migrationSource.includes('CREATE OR REPLACE FUNCTION public.perform_platform_billing_operation') &&
      migrationSource.includes('platform.billing.manual_payment_marked') &&
      migrationSource.includes('platform.billing.org_suspended') &&
      migrationSource.includes('platform.billing.org_resumed') &&
      migrationSource.includes('platform.billing.refund_requested') &&
      migrationSource.includes('GRANT EXECUTE') &&
      billingOperationsSource.includes('perform_platform_billing_operation') &&
      billingOperationsSource.includes('buildPlatformBillingOperationRpcArgs') &&
      billingOperationsSource.includes('mark_manual_payment') &&
      billingOperationsSource.includes('request_refund')
    ) {
      record('pass', 'SaaS platform billing operations RPC draft', 'platform billing operations are RPC-backed and audit-log oriented');
    } else {
      record('fail', 'SaaS platform billing operations RPC draft', 'platform billing operations must cover manual payment, suspend, resume, refund request, and audit logging');
    }
  }
}

function checkFeatureFlagEnvDefaults() {
  for (const [key, expected] of Object.entries(FEATURE_FLAG_DEFAULTS)) {
    const actual = normalizeEnvValue(process.env[key]).toLowerCase();
    if (!actual) {
      record('pass', `flag:${key}`, `uses code default ${expected}`);
    } else if (actual === expected) {
      record('pass', `flag:${key}`, actual);
    } else {
      const status = key === 'ENABLE_IMAGE_AI' ? 'fail' : 'warn';
      record(status, `flag:${key}`, `expected default ${expected}, got ${actual}`);
    }
  }
}

function checkBillingReadiness() {
  const provider = normalizeEnvValue(process.env.BILLING_PROVIDER).toLowerCase();
  if (!provider) {
    record('pass', 'Billing provider', 'not configured; billing stays disabled');
    return;
  }

  if (!(provider in BILLING_PROVIDER_KEYS)) {
    record('fail', 'Billing provider', `unsupported provider ${provider}`);
    return;
  }

  const missing = BILLING_PROVIDER_KEYS[provider].filter((key) => isPlaceholder(process.env[key]));
  if (missing.length > 0) {
    record('warn', 'Billing credentials', `${provider} missing or placeholder: ${missing.join(', ')}`);
  } else {
    record('pass', 'Billing credentials', `${provider} configured`);
  }
}

function checkSupabaseSafety() {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const expected =
    normalizeEnvValue(process.env.SUPABASE_PROJECT_ID_EXPECTED) ||
    normalizeEnvValue(process.env.SAAS_SUPABASE_PROJECT_ID);
  const internal =
    normalizeEnvValue(process.env.INTERNAL_SUPABASE_PROJECT_ID) ||
    DEFAULT_INTERNAL_SUPABASE_PROJECT_ID;

  if (!url || isPlaceholder(url)) return;

  if (internal && url.includes(internal)) {
    record('fail', 'Supabase safety', 'SaaS env points to internal/live Supabase project');
  } else {
    record('pass', 'Supabase safety', 'does not point to internal/live project');
  }

  if (expected && !isPlaceholder(expected) && !url.includes(expected)) {
    record('fail', 'Supabase project id', `URL does not include expected id ${expected}`);
  } else if (expected && !isPlaceholder(expected)) {
    record('pass', 'Supabase project id', expected);
  }
}

function checkSecretFiles() {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const gitignore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf8')
    : '';

  for (const pattern of ['.env*.local', '.vercel/', '.vercel.*.env']) {
    if (gitignore.includes(pattern)) {
      record('pass', `gitignore:${pattern}`, 'protected');
    } else {
      record('fail', `gitignore:${pattern}`, 'missing');
    }
  }
}

function checkLocalTools() {
  if (commandExists('vercel')) {
    record('pass', 'Vercel CLI', 'available');
  } else {
    record('warn', 'Vercel CLI', 'not found; required only for env/deploy operations');
  }

  if (commandExists('supabase')) {
    record('pass', 'Supabase CLI', 'available');
  } else {
    record('warn', 'Supabase CLI', 'not found; required only for migration operations');
  }
}

function printSummary() {
  let failCount = 0;
  let warnCount = 0;

  for (const check of checks) {
    if (check.status === 'fail') failCount += 1;
    if (check.status === 'warn') warnCount += 1;
    const prefix =
      check.status === 'pass'
        ? 'PASS'
        : check.status === 'warn'
          ? 'WARN'
          : 'FAIL';
    console.log(`[saas-doctor] ${prefix}: ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
  }

  console.log('');
  console.log(`[saas-doctor] Summary: ${checks.length - failCount - warnCount} pass, ${warnCount} warn, ${failCount} fail`);

  if (failCount > 0 || (strict && warnCount > 0)) {
    process.exitCode = 1;
  }
}

loadSaasEnvIfPresent();
checkGitBranch();
checkVercelProject();
checkEnvValues();
checkCommercialFoundation();
checkFeatureFlagEnvDefaults();
checkBillingReadiness();
checkSupabaseSafety();
checkSecretFiles();
checkLocalTools();
printSummary();
