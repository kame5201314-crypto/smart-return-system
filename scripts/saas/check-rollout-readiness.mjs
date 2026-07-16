#!/usr/bin/env node

import { execSync } from 'node:child_process';
import process from 'node:process';

const EXPECTED_BRANCH = 'develop-saas';
const EXPECTED_TEXT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_FORBIDDEN_SUPABASE_REFS = [
  'fdzfnenizyppxglypden',
  'sntbrntwztkllwkutooi',
];
const BILLING_PROVIDER_KEYS = {
  ecpay: ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV', 'ECPAY_MODE'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_BASIC', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_PRO'],
  tappay: ['TAPPAY_PARTNER_KEY', 'TAPPAY_MERCHANT_ID', 'TAPPAY_APP_ID', 'TAPPAY_APP_KEY', 'TAPPAY_MODE'],
};

const strict = process.argv.includes('--strict') || parseBool(process.env.SAAS_ROLLOUT_STRICT);
const checks = [];

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function isPlaceholder(value) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return (
    !normalized ||
    normalized.includes('replace_with') ||
    normalized.includes('replace-with') ||
    normalized.includes('your_') ||
    normalized.includes('your-') ||
    normalized.includes('change_me') ||
    normalized.includes('change-me') ||
    normalized.includes('changeme') ||
    normalized.includes('placeholder') ||
    normalized.includes('missing')
  );
}

const CLOUDFLARE_TEST_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

function isCloudflareTestKey(value) {
  return CLOUDFLARE_TEST_KEYS.has(normalizeEnvValue(value));
}

function isWeakPassword(value) {
  const normalized = normalizeEnvValue(value);
  return isPlaceholder(normalized) || normalized.length < 12;
}

function record(status, label, detail = '') {
  checks.push({ status, label, detail });
}

function warnOrFail(label, detail) {
  record(strict ? 'fail' : 'warn', label, detail);
}

function gitOutput(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function checkGitState() {
  if (parseBool(process.env.SAAS_ROLLOUT_SKIP_GIT_CHECK)) {
    record('warn', 'Git state', 'skipped by SAAS_ROLLOUT_SKIP_GIT_CHECK');
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
    warnOrFail('Working tree', 'has local changes; finish or commit before rollout');
  } else {
    record('pass', 'Working tree', 'clean');
  }
}

function checkSaasProjectSafety() {
  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  const saasRef = normalizeEnvValue(process.env.SAAS_SUPABASE_PROJECT_ID);
  const expectedRef = normalizeEnvValue(process.env.SUPABASE_PROJECT_ID_EXPECTED) || saasRef;
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
    record('fail', 'SUPABASE_PROJECT_ID_EXPECTED', `expected ${saasRef}, got ${expectedRef}`);
  } else {
    record('pass', 'SUPABASE_PROJECT_ID_EXPECTED', expectedRef);
  }

  for (const forbiddenRef of forbiddenRefs) {
    if (saasRef === forbiddenRef || expectedRef === forbiddenRef || supabaseUrl.includes(forbiddenRef)) {
      record('fail', 'Supabase project safety', `forbidden internal/live project ref: ${forbiddenRef}`);
      return;
    }
  }
  record('pass', 'Supabase project safety', 'not internal/live project refs');

  if (!supabaseUrl) {
    record('fail', 'NEXT_PUBLIC_SUPABASE_URL', 'missing');
  } else if (expectedRef && !supabaseUrl.includes(expectedRef)) {
    record('fail', 'NEXT_PUBLIC_SUPABASE_URL', `URL does not include expected SaaS ref ${expectedRef}`);
  } else {
    record('pass', 'NEXT_PUBLIC_SUPABASE_URL', 'matches expected SaaS ref');
  }
}

function checkRequiredSecrets() {
  const requiredSecrets = [
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_SESSION_SECRET',
    'CRON_SECRET',
    'SCHEMA_DRIFT_ALERT_TOKEN',
  ];

  for (const key of requiredSecrets) {
    if (isPlaceholder(process.env[key])) {
      warnOrFail(`env:${key}`, 'missing or placeholder');
    } else {
      record('pass', `env:${key}`, 'set');
    }
  }

  if (isPlaceholder(process.env.GEMINI_API_KEY)) {
    warnOrFail('env:GEMINI_API_KEY', 'missing or placeholder; return AI cannot pass strict rollout');
  } else {
    record('pass', 'env:GEMINI_API_KEY', 'set');
  }

  if (isPlaceholder(process.env.ADMIN_USERNAME)) {
    warnOrFail('env:ADMIN_USERNAME', 'missing or placeholder');
  } else {
    record('pass', 'env:ADMIN_USERNAME', 'set');
  }

  if (isWeakPassword(process.env.ADMIN_PASSWORD)) {
    warnOrFail('env:ADMIN_PASSWORD', 'missing, placeholder, or shorter than 12 characters');
  } else {
    record('pass', 'env:ADMIN_PASSWORD', 'set');
  }
}

function checkAppUrlAndObservability() {
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  if (isPlaceholder(appUrl)) {
    warnOrFail('NEXT_PUBLIC_APP_URL', 'missing; needed for invite links, callbacks, and smoke checks');
  } else if (/^https:\/\/localhost(?::\d+)?/i.test(appUrl) || /^http:\/\/localhost(?::\d+)?/i.test(appUrl)) {
    warnOrFail('NEXT_PUBLIC_APP_URL', `must not point to localhost for rollout: ${appUrl}`);
  } else if (!appUrl.startsWith('https://')) {
    warnOrFail('NEXT_PUBLIC_APP_URL', `expected https URL for rollout: ${appUrl}`);
  } else {
    record('pass', 'NEXT_PUBLIC_APP_URL', appUrl);
  }

  const sentryDsn =
    normalizeEnvValue(process.env.SENTRY_DSN) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (sentryDsn) {
    record('pass', 'Sentry/logging DSN', 'set');
  } else if (
    parseBool(process.env.ENABLE_PUBLIC_SIGNUP) ||
    parseBool(process.env.ENABLE_PUBLIC_LEAD_CAPTURE) ||
    parseBool(process.env.ENABLE_GOOGLE_AUTH) ||
    parseBool(process.env.ENABLE_GOOGLE_TRIAL_SIGNUP) ||
    parseBool(process.env.ENABLE_EMAIL_OTP_SIGNUP) ||
    parseBool(process.env.ENABLE_PHONE_OTP_SIGNUP) ||
    parseBool(process.env.ENABLE_EMAIL_PASSWORD_RECOVERY) ||
    parseBool(process.env.ENABLE_PHONE_PASSWORD_RECOVERY) ||
    parseBool(process.env.ENABLE_BILLING) ||
    parseBool(process.env.ENABLE_SUBSCRIPTION_PLAN)
  ) {
    warnOrFail(
      'Sentry/logging DSN',
      'required before public signup, subscription, or paid billing rollout'
    );
  } else {
    record('warn', 'Sentry/logging DSN', 'missing; add before public rollout');
  }
}

function checkAiSafety() {
  const imageAi = normalizeEnvValue(process.env.ENABLE_IMAGE_AI).toLowerCase();
  if (!imageAi || imageAi === 'false' || imageAi === '0') {
    record('pass', 'ENABLE_IMAGE_AI', 'disabled');
  } else {
    record('fail', 'ENABLE_IMAGE_AI', 'must stay false for return AI');
  }

  const aiUsageLimit = normalizeEnvValue(process.env.ENABLE_AI_USAGE_LIMIT).toLowerCase();
  if (aiUsageLimit === 'true' || aiUsageLimit === '1') {
    record('pass', 'ENABLE_AI_USAGE_LIMIT', 'enabled');
  } else {
    warnOrFail('ENABLE_AI_USAGE_LIMIT', 'must be true before rollout to enforce plan quota');
  }

  const model = normalizeEnvValue(process.env.GEMINI_TEXT_MODEL).replace(/^models\//, '');
  if (!model || model === EXPECTED_TEXT_MODEL) {
    record('pass', 'GEMINI_TEXT_MODEL', model || `defaults to ${EXPECTED_TEXT_MODEL}`);
  } else {
    warnOrFail('GEMINI_TEXT_MODEL', `expected ${EXPECTED_TEXT_MODEL}, got ${model}`);
  }
}

function checkControlledRolloutFlags() {
  const publicSignup = normalizeEnvValue(process.env.ENABLE_PUBLIC_SIGNUP).toLowerCase();
  const publicLeadCapture = normalizeEnvValue(process.env.ENABLE_PUBLIC_LEAD_CAPTURE).toLowerCase();
  const googleAuth = normalizeEnvValue(process.env.ENABLE_GOOGLE_AUTH).toLowerCase();
  const googleTrialSignup = normalizeEnvValue(process.env.ENABLE_GOOGLE_TRIAL_SIGNUP).toLowerCase();
  const emailOtpSignup = normalizeEnvValue(process.env.ENABLE_EMAIL_OTP_SIGNUP).toLowerCase();
  const phoneOtpSignup = normalizeEnvValue(process.env.ENABLE_PHONE_OTP_SIGNUP).toLowerCase();
  const emailPasswordRecovery = normalizeEnvValue(process.env.ENABLE_EMAIL_PASSWORD_RECOVERY).toLowerCase();
  const phonePasswordRecovery = normalizeEnvValue(process.env.ENABLE_PHONE_PASSWORD_RECOVERY).toLowerCase();
  const trialExpiryCron = normalizeEnvValue(process.env.ENABLE_TRIAL_EXPIRY_CRON).toLowerCase();
  const multiTenantAdmin = normalizeEnvValue(process.env.ENABLE_MULTI_TENANT_ADMIN).toLowerCase();
  const subscriptionPlan = normalizeEnvValue(process.env.ENABLE_SUBSCRIPTION_PLAN).toLowerCase();
  const advancedAnalytics = normalizeEnvValue(process.env.ENABLE_ADVANCED_ANALYTICS).toLowerCase();

  record('pass', 'ENABLE_PUBLIC_SIGNUP', publicSignup === 'true' ? 'enabled intentionally' : 'closed for controlled rollout');
  record('pass', 'ENABLE_PUBLIC_LEAD_CAPTURE', publicLeadCapture === 'true' ? 'enabled intentionally' : 'closed for controlled rollout');
  record('pass', 'ENABLE_GOOGLE_AUTH', googleAuth === 'true' ? 'enabled intentionally' : 'closed until Google provider rollout');
  record('pass', 'ENABLE_GOOGLE_TRIAL_SIGNUP', googleTrialSignup === 'true' ? 'enabled intentionally' : 'closed until self-service trial rollout');
  record('pass', 'ENABLE_EMAIL_OTP_SIGNUP', emailOtpSignup === 'true' ? 'enabled intentionally' : 'closed until verified email rollout');
  record('pass', 'ENABLE_PHONE_OTP_SIGNUP', phoneOtpSignup === 'true' ? 'enabled intentionally' : 'closed until verified SMS rollout');
  record('pass', 'ENABLE_EMAIL_PASSWORD_RECOVERY', emailPasswordRecovery === 'true' ? 'enabled intentionally' : 'closed until verified recovery rollout');
  record('pass', 'ENABLE_PHONE_PASSWORD_RECOVERY', phonePasswordRecovery === 'true' ? 'enabled intentionally' : 'closed until verified recovery rollout');
  record('pass', 'ENABLE_TRIAL_EXPIRY_CRON', trialExpiryCron === 'true' ? 'enabled intentionally' : 'closed until scoped lifecycle rollout');
  record('pass', 'ENABLE_MULTI_TENANT_ADMIN', multiTenantAdmin === 'true' ? 'enabled intentionally' : 'closed until platform admin rollout');
  record('pass', 'ENABLE_SUBSCRIPTION_PLAN', subscriptionPlan === 'true' ? 'enabled intentionally' : 'closed until billing rollout');
  record('pass', 'ENABLE_ADVANCED_ANALYTICS', advancedAnalytics === 'true' ? 'enabled intentionally' : 'closed unless plan rollout approves it');
}

function checkGoogleTrialReadiness() {
  const googleAuthEnabled = parseBool(process.env.ENABLE_GOOGLE_AUTH);
  const googleTrialEnabled = parseBool(process.env.ENABLE_GOOGLE_TRIAL_SIGNUP);
  const trialExpiryEnabled = parseBool(process.env.ENABLE_TRIAL_EXPIRY_CRON);

  if (googleTrialEnabled && !googleAuthEnabled) {
    record(
      'fail',
      'Google trial dependency',
      'ENABLE_GOOGLE_TRIAL_SIGNUP=true requires ENABLE_GOOGLE_AUTH=true'
    );
    return;
  }

  if (googleTrialEnabled && !trialExpiryEnabled) {
    record(
      'fail',
      'Google trial lifecycle',
      'ENABLE_GOOGLE_TRIAL_SIGNUP=true requires ENABLE_TRIAL_EXPIRY_CRON=true'
    );
    return;
  }

  if (googleTrialEnabled) {
    record(
      'pass',
      'Google trial rollout',
      'Google auth and scoped trial-expiry lifecycle are enabled together'
    );
  } else if (googleAuthEnabled) {
    record(
      'pass',
      'Google login rollout',
      'existing-merchant Google login is enabled without self-service provisioning'
    );
  } else {
    record('pass', 'Google rollout', 'Google login and self-service trial remain closed');
  }
}

function checkAuthCaptchaReadiness() {
  if (!parseBool(process.env.SAAS_AUTH_CAPTCHA_READY)) {
    record('pass', 'Auth CAPTCHA rollout', 'server-side validation remains closed');
    return;
  }

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (isPlaceholder(siteKey)) {
    record('fail', 'Auth CAPTCHA site key', 'a real public Turnstile site key is required');
  } else if (isCloudflareTestKey(siteKey)) {
    record('fail', 'Auth CAPTCHA site key', 'Cloudflare test keys are not allowed for production rollout');
  } else {
    record('pass', 'Auth CAPTCHA site key', 'configured');
  }

  if (isPlaceholder(secretKey)) {
    record('fail', 'Auth CAPTCHA server secret', 'TURNSTILE_SECRET_KEY is required for legacy admin Siteverify');
  } else if (isCloudflareTestKey(secretKey)) {
    record('fail', 'Auth CAPTCHA server secret', 'Cloudflare test secrets are not allowed for production rollout');
  } else {
    record('pass', 'Auth CAPTCHA server secret', 'configured server-side');
  }

  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.hostname === 'localhost') {
      throw new Error('untrusted app URL');
    }
    record('pass', 'Auth CAPTCHA hostname', parsed.hostname);
  } catch {
    record('fail', 'Auth CAPTCHA hostname', 'a trusted HTTPS NEXT_PUBLIC_APP_URL is required');
  }
}

function checkVerifiedSignupReadiness() {
  const emailEnabled = parseBool(process.env.ENABLE_EMAIL_OTP_SIGNUP);
  const phoneEnabled = parseBool(process.env.ENABLE_PHONE_OTP_SIGNUP);
  if (!emailEnabled && !phoneEnabled) {
    record('pass', 'Verified signup rollout', 'email and phone OTP signup remain closed');
    return;
  }

  if (!parseBool(process.env.ENABLE_TRIAL_EXPIRY_CRON)) {
    record('fail', 'Verified signup lifecycle', 'OTP signup requires ENABLE_TRIAL_EXPIRY_CRON=true');
  }

  if (!parseBool(process.env.SAAS_AUTH_CAPTCHA_READY)) {
    record('fail', 'Verified signup CAPTCHA', 'SAAS_AUTH_CAPTCHA_READY=true is required');
  }

  if (!parseBool(process.env.SAAS_VERIFIED_SIGNUP_MIGRATION_READY)) {
    record(
      'fail',
      'Verified signup migration',
      'SAAS_VERIFIED_SIGNUP_MIGRATION_READY=true is required after migration 044 verification'
    );
  }

  if (isPlaceholder(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    record('fail', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'a real public site key is required');
  }

  if (emailEnabled && !parseBool(process.env.SAAS_EMAIL_OTP_PROVIDER_READY)) {
    record('fail', 'Email OTP provider', 'SAAS_EMAIL_OTP_PROVIDER_READY=true is required');
  } else if (emailEnabled) {
    record('pass', 'Email OTP provider', 'marked ready for controlled rollout');
  }

  if (phoneEnabled && !parseBool(process.env.SAAS_PHONE_OTP_PROVIDER_READY)) {
    record('fail', 'Phone OTP provider', 'SAAS_PHONE_OTP_PROVIDER_READY=true is required');
  } else if (phoneEnabled) {
    record('pass', 'Phone OTP provider', 'marked ready for controlled rollout');
  }
}

function checkPasswordRecoveryReadiness() {
  const emailEnabled = parseBool(process.env.ENABLE_EMAIL_PASSWORD_RECOVERY);
  const phoneEnabled = parseBool(process.env.ENABLE_PHONE_PASSWORD_RECOVERY);
  if (!emailEnabled && !phoneEnabled) {
    record('pass', 'Password recovery rollout', 'email and phone recovery remain closed');
    return;
  }

  if (!parseBool(process.env.SAAS_AUTH_CAPTCHA_READY)) {
    record('fail', 'Password recovery CAPTCHA', 'SAAS_AUTH_CAPTCHA_READY=true is required');
  }

  if (isPlaceholder(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    record('fail', 'Password recovery site key', 'a real public Turnstile site key is required');
  }

  if (emailEnabled && !parseBool(process.env.SAAS_EMAIL_OTP_PROVIDER_READY)) {
    record(
      'fail',
      'Email recovery provider',
      'SAAS_EMAIL_OTP_PROVIDER_READY=true requires a six-digit recovery template and delivery smoke test'
    );
  } else if (emailEnabled) {
    record('pass', 'Email recovery provider', 'marked ready for controlled rollout');
  }

  if (phoneEnabled && !parseBool(process.env.SAAS_PHONE_OTP_PROVIDER_READY)) {
    record(
      'fail',
      'Phone recovery provider',
      'SAAS_PHONE_OTP_PROVIDER_READY=true requires an SMS delivery smoke test'
    );
  } else if (phoneEnabled) {
    record('pass', 'Phone recovery provider', 'marked ready for controlled rollout');
  }
}

function checkBillingReadiness() {
  const billingEnabled = parseBool(process.env.ENABLE_BILLING);
  const provider = normalizeEnvValue(process.env.BILLING_PROVIDER).toLowerCase();

  if (!billingEnabled) {
    record('warn', 'Billing rollout', 'ENABLE_BILLING=false; OK for manual Beta, not ready for paid self-serve');
    return;
  }

  if (!provider || !BILLING_PROVIDER_KEYS[provider]) {
    record('fail', 'BILLING_PROVIDER', `expected one of ${Object.keys(BILLING_PROVIDER_KEYS).join(', ')}`);
    return;
  }

  record('pass', 'BILLING_PROVIDER', provider);
  for (const key of BILLING_PROVIDER_KEYS[provider]) {
    if (isPlaceholder(process.env[key])) {
      record('fail', `billing:${key}`, 'missing or placeholder');
    } else {
      record('pass', `billing:${key}`, 'set');
    }
  }
}

function printSummary() {
  for (const check of checks) {
    const prefix = `[saas-rollout] ${check.status.toUpperCase()}: ${check.label}`;
    console.log(check.detail ? `${prefix} - ${check.detail}` : prefix);
  }

  const failCount = checks.filter((check) => check.status === 'fail').length;
  const warnCount = checks.filter((check) => check.status === 'warn').length;
  const passCount = checks.filter((check) => check.status === 'pass').length;

  console.log(`\n[saas-rollout] Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);
  console.log('[saas-rollout] No external changes were made by this check.');

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

checkGitState();
checkSaasProjectSafety();
checkRequiredSecrets();
checkAppUrlAndObservability();
checkAiSafety();
checkControlledRolloutFlags();
checkGoogleTrialReadiness();
checkAuthCaptchaReadiness();
checkVerifiedSignupReadiness();
checkPasswordRecoveryReadiness();
checkBillingReadiness();
printSummary();
