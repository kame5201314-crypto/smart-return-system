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
    'lib/saas/platform-admin.ts',
    'lib/saas/platform-admin-data.ts',
    'lib/saas/platform-admin-provisioning.ts',
    'lib/saas/billing.ts',
    'lib/saas/public-signup.ts',
    'lib/saas/signup-request.ts',
    'lib/saas/signup-request-repository.ts',
    'app/api/saas/signup/route.ts',
    'app/api/billing/ecpay/webhook/route.ts',
    'scripts/saas/check-migration-plan.mjs',
    'scripts/saas/check-saas-schema-readiness.mjs',
    'app/api/internal/saas/orgs/route.ts',
    'app/api/internal/saas/orgs/[id]/route.ts',
    'app/api/internal/saas/billing/events/route.ts',
    'supabase/migrations/023_saas_commercial_foundation.sql',
    'supabase/migrations/024_saas_commercial_v2.sql',
    'supabase/migrations/025_attach_org_id_to_business_tables.sql',
    'supabase/migrations/026_saas_public_signup_requests.sql',
    'supabase/migrations/027_saas_platform_admin_read_model.sql',
    'supabase/migrations/028_saas_manual_beta_org_provisioning.sql',
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

  const saasSchemaGatePath = path.resolve(process.cwd(), 'scripts/saas/check-saas-schema-readiness.mjs');
  if (fs.existsSync(saasSchemaGatePath)) {
    const source = fs.readFileSync(saasSchemaGatePath, 'utf8');
    if (
      source.includes('SAAS_SCHEMA_GATE_STRICT') &&
      source.includes('signup_requests') &&
      source.includes('billing_events') &&
      source.includes('organization_members') &&
      source.includes('org_id')
    ) {
      record('pass', 'SaaS schema readiness gate', 'checks tenant, signup, billing, and platform-admin schema before live wiring');
    } else {
      record('fail', 'SaaS schema readiness gate', 'must check SaaS tenant, signup, billing, and platform-admin schema');
    }
  }

  const saasMigrationPlanPath = path.resolve(process.cwd(), 'scripts/saas/check-migration-plan.mjs');
  if (fs.existsSync(saasMigrationPlanPath)) {
    const source = fs.readFileSync(saasMigrationPlanPath, 'utf8');
    if (
      source.includes('SUPABASE_DB_PASSWORD') &&
      source.includes('DEFAULT_FORBIDDEN_SUPABASE_REFS') &&
      source.includes('REQUIRED_SAAS_MIGRATIONS') &&
      source.includes('028_saas_manual_beta_org_provisioning.sql') &&
      source.includes('No migrations were applied by this check')
    ) {
      record('pass', 'SaaS migration plan check', 'validates target ref, DB password, and migration chain before apply');
    } else {
      record('fail', 'SaaS migration plan check', 'must validate SaaS target, DB password, and full migration chain without applying migrations');
    }
  }

  const uiBackendContractsPath = path.resolve(process.cwd(), 'lib/saas/ui-backend-contracts.ts');
  if (fs.existsSync(uiBackendContractsPath)) {
    const source = fs.readFileSync(uiBackendContractsPath, 'utf8');
    if (
      source.includes('buildUsageSettingsView') &&
      source.includes('buildBillingSettingsView') &&
      source.includes('buildTeamSettingsView') &&
      source.includes('buildPlatformOrganizationListView') &&
      source.includes('buildPlatformOrganizationDetailView') &&
      source.includes('buildPlatformBillingEventsView')
    ) {
      record('pass', 'SaaS UI/backend DTO builders', 'settings and platform admin contracts have validated DTO builders');
    } else {
      record('fail', 'SaaS UI/backend DTO builders', 'UI contracts must have validation builders before live backend wiring');
    }
  }

  const platformAdminPath = path.resolve(process.cwd(), 'lib/saas/platform-admin.ts');
  if (fs.existsSync(platformAdminPath)) {
    const source = fs.readFileSync(platformAdminPath, 'utf8');
    if (
      source.includes('requirePlatformAdminAccess') &&
      source.includes('requireRouteAuth({ requireAdmin: true })') &&
      source.includes('multi_tenant_admin') &&
      !source.includes('createAdminClient') &&
      !source.includes('createUntypedAdminClient')
    ) {
      record('pass', 'SaaS platform admin guard', 'admin auth + feature flag gate found');
    } else {
      record('fail', 'SaaS platform admin guard', 'must require admin auth and multi_tenant_admin flag without direct service-role access');
    }
  }

  const platformAdminDataPath = path.resolve(process.cwd(), 'lib/saas/platform-admin-data.ts');
  const platformOrgRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/orgs/route.ts');
  const platformOrgDetailRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/orgs/[id]/route.ts');
  const platformBillingEventsRoutePath = path.resolve(process.cwd(), 'app/api/internal/saas/billing/events/route.ts');
  if (
    fs.existsSync(platformAdminDataPath) &&
    fs.existsSync(platformOrgRoutePath) &&
    fs.existsSync(platformOrgDetailRoutePath) &&
    fs.existsSync(platformBillingEventsRoutePath)
  ) {
    const dataSource = fs.readFileSync(platformAdminDataPath, 'utf8');
    const orgRouteSource = fs.readFileSync(platformOrgRoutePath, 'utf8');
    const orgDetailRouteSource = fs.readFileSync(platformOrgDetailRoutePath, 'utf8');
    const billingRouteSource = fs.readFileSync(platformBillingEventsRoutePath, 'utf8');
    const routesUseGuard = [orgRouteSource, orgDetailRouteSource, billingRouteSource].every((source) =>
      source.includes('requirePlatformAdminAccess') &&
      source.includes('createUntypedAdminClient')
    );
    const dataLayerHasRepository =
      dataSource.includes('createPlatformAdminDataRepository') &&
      dataSource.includes('PlatformAdminDataRepository');
    const orgRouteHasProvisioning =
      orgRouteSource.includes('handleCreateManualBetaOrganization') &&
      orgRouteSource.includes('createPlatformOrgProvisioningRepository') &&
      orgRouteSource.includes('export async function POST');
    if (routesUseGuard && dataLayerHasRepository && orgRouteHasProvisioning) {
      record('pass', 'SaaS platform admin API routes', 'internal org and billing routes are guard-gated, including manual Beta provisioning');
    } else {
      record('fail', 'SaaS platform admin API routes', 'internal SaaS API routes must use platform admin guard, repository layer, and gated manual Beta provisioning');
    }
  }

  const billingFoundationPath = path.resolve(process.cwd(), 'lib/saas/billing.ts');
  const ecpayWebhookRoutePath = path.resolve(process.cwd(), 'app/api/billing/ecpay/webhook/route.ts');
  if (fs.existsSync(billingFoundationPath) && fs.existsSync(ecpayWebhookRoutePath)) {
    const billingSource = fs.readFileSync(billingFoundationPath, 'utf8');
    const ecpayRouteSource = fs.readFileSync(ecpayWebhookRoutePath, 'utf8');
    if (
      billingSource.includes('resolveBillingWebhookState') &&
      billingSource.includes('createBillingEventsRepository') &&
      billingSource.includes('buildECPayCheckMacValue') &&
      billingSource.includes('verifyECPayCheckMacValue') &&
      billingSource.includes('provider_event_id') &&
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
