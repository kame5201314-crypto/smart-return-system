import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/saas/check-rollout-readiness.mjs');
const saasProjectRef = 'auyznbwtjvemyamujmgt';

function runRolloutCheck(env: Record<string, string> = {}, args: string[] = ['--strict']) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_MODE: 'saas',
      SAAS_SUPABASE_PROJECT_ID: saasProjectRef,
      SUPABASE_PROJECT_ID_EXPECTED: saasProjectRef,
      INTERNAL_SUPABASE_PROJECT_ID: 'fdzfnenizyppxglypden',
      NEXT_PUBLIC_SUPABASE_URL: `https://${saasProjectRef}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'strong-admin-password',
      ADMIN_SESSION_SECRET: 'admin-secret',
      CRON_SECRET: 'cron-secret',
      SCHEMA_DRIFT_ALERT_TOKEN: 'schema-token',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_TEXT_MODEL: 'gemini-2.5-flash-lite',
      NEXT_PUBLIC_APP_URL: 'https://saas.smart-return.test',
      ENABLE_IMAGE_AI: 'false',
      ENABLE_AI_USAGE_LIMIT: 'true',
      ENABLE_PUBLIC_SIGNUP: 'false',
      ENABLE_PUBLIC_LEAD_CAPTURE: 'false',
      ENABLE_GOOGLE_AUTH: 'false',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'false',
      ENABLE_TRIAL_EXPIRY_CRON: 'false',
      ENABLE_BILLING: 'false',
      ENABLE_SUBSCRIPTION_PLAN: 'false',
      ENABLE_ADVANCED_ANALYTICS: 'false',
      ENABLE_MULTI_TENANT_ADMIN: 'false',
      SAAS_ROLLOUT_SKIP_GIT_CHECK: '1',
      ...env,
    },
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

describe('SaaS rollout readiness check', () => {
  it('passes strict mode for a safe manual Beta rollout configuration', () => {
    const result = runRolloutCheck();

    expect(result.status).toBe(0);
    expect(result.output).toContain('APP_MODE - saas');
    expect(result.output).toContain('GEMINI_API_KEY - set');
    expect(result.output).toContain('Billing rollout - ENABLE_BILLING=false');
    expect(result.output).toContain('No external changes were made by this check.');
  });

  it('fails strict mode when Gemini key is missing or placeholder', () => {
    const result = runRolloutCheck({ GEMINI_API_KEY: 'missing_or_placeholder' });

    expect(result.status).toBe(1);
    expect(result.output).toContain('env:GEMINI_API_KEY');
    expect(result.output).toContain('missing or placeholder');
  });

  it('fails strict mode when the admin password is missing or placeholder', () => {
    const missing = runRolloutCheck({ ADMIN_PASSWORD: '' });
    const placeholder = runRolloutCheck({ ADMIN_PASSWORD: 'change_me_to_a_strong_password' });

    expect(missing.status).toBe(1);
    expect(missing.output).toContain('env:ADMIN_PASSWORD');
    expect(missing.output).toContain('missing, placeholder, or shorter than 12 characters');
    expect(placeholder.status).toBe(1);
    expect(placeholder.output).toContain('env:ADMIN_PASSWORD');
  });

  it('fails strict mode when the admin username is missing', () => {
    const result = runRolloutCheck({ ADMIN_USERNAME: '' });

    expect(result.status).toBe(1);
    expect(result.output).toContain('env:ADMIN_USERNAME');
    expect(result.output).toContain('missing or placeholder');
  });

  it('rejects internal Supabase project refs', () => {
    const result = runRolloutCheck({
      SAAS_SUPABASE_PROJECT_ID: 'fdzfnenizyppxglypden',
      SUPABASE_PROJECT_ID_EXPECTED: 'fdzfnenizyppxglypden',
      NEXT_PUBLIC_SUPABASE_URL: 'https://fdzfnenizyppxglypden.supabase.co',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('forbidden internal/live project ref: fdzfnenizyppxglypden');
  });

  it('fails strict mode when app URL is still a placeholder domain', () => {
    const result = runRolloutCheck({
      NEXT_PUBLIC_APP_URL: 'https://app.your-saas-domain.com',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('NEXT_PUBLIC_APP_URL');
    expect(result.output).toContain('missing; needed for invite links');
  });

  it('requires billing credentials when billing is enabled', () => {
    const result = runRolloutCheck({
      ENABLE_BILLING: 'true',
      BILLING_PROVIDER: 'ecpay',
      ECPAY_MERCHANT_ID: '',
      ECPAY_HASH_KEY: '',
      ECPAY_HASH_IV: '',
      ECPAY_MODE: '',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('billing:ECPAY_MERCHANT_ID');
    expect(result.output).toContain('billing:ECPAY_HASH_KEY');
    expect(result.output).toContain('billing:ECPAY_HASH_IV');
  });

  it('requires logging when public signup is enabled', () => {
    const result = runRolloutCheck({
      ENABLE_PUBLIC_SIGNUP: 'true',
      SENTRY_DSN: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('Sentry/logging DSN');
    expect(result.output).toContain('required before public signup');
  });

  it('passes logging gate for public rollout when a logging DSN is set', () => {
    const result = runRolloutCheck({
      ENABLE_PUBLIC_SIGNUP: 'true',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain('Sentry/logging DSN - set');
  });

  it('keeps existing-merchant Google login independent from self-service trial', () => {
    const result = runRolloutCheck({
      ENABLE_GOOGLE_AUTH: 'true',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'Google login rollout - existing-merchant Google login is enabled without self-service provisioning'
    );
  });

  it('rejects self-service trial when Google auth is not enabled', () => {
    const result = runRolloutCheck({
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      ENABLE_TRIAL_EXPIRY_CRON: 'true',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'Google trial dependency - ENABLE_GOOGLE_TRIAL_SIGNUP=true requires ENABLE_GOOGLE_AUTH=true'
    );
  });

  it('rejects self-service trial without the scoped expiry lifecycle', () => {
    const result = runRolloutCheck({
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'Google trial lifecycle - ENABLE_GOOGLE_TRIAL_SIGNUP=true requires ENABLE_TRIAL_EXPIRY_CRON=true'
    );
  });

  it('passes Google self-service trial only with auth, lifecycle, and logging', () => {
    const result = runRolloutCheck({
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      ENABLE_TRIAL_EXPIRY_CRON: 'true',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'Google trial rollout - Google auth and scoped trial-expiry lifecycle are enabled together'
    );
  });
});
