import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/saas/production-smoke.mjs');
const source = readFileSync(scriptPath, 'utf8');

describe('SaaS production smoke contract', () => {
  it('checks the public password-recovery entry alongside the existing public routes', () => {
    expect(source).toContain("'/forgot-password'");
    expect(source).toMatch(/for \(const path of \[[\s\S]*'\/forgot-password'[\s\S]*\]\)/);
  });

  it('keeps anonymous reset-password requests behind authenticated recovery', () => {
    expect(source).toContain("expectRedirect('/reset-password'");
    expect(source).toContain('/\\/login(?:\\?|$)/');
  });

  it('bounds every fetch, including response-body reads, with a cleared abort timer', () => {
    expect(source).toContain("--timeout-ms=");
    expect(source).toContain('SAAS_PRODUCTION_SMOKE_TIMEOUT_MS');
    expect(source).toContain('const controller = new AbortController()');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain('clearTimeout(timeout)');
    expect(source.indexOf('await response.text()')).toBeLessThan(source.indexOf('clearTimeout(timeout)'));
    expect(source.indexOf('await response.json()')).toBeLessThan(source.indexOf('clearTimeout(timeout)'));
  });

  it('offers an explicit post-deploy account-registration smoke without changing the default probe', () => {
    expect(source).toContain("args.includes('--expect-account-registration')");
    expect(source).toContain('SAAS_PRODUCTION_SMOKE_EXPECT_ACCOUNT_REGISTRATION');
    expect(source).toContain("get('/login?plan=growth', { text: true })");
    expect(source).toContain("text.includes('註冊新帳號')");
    expect(source).toContain("text.includes('/signup?plan=growth')");
    expect(source).toContain("get('/signup?plan=growth', { text: true })");
    expect(source).toContain("text.includes('使用 Google 繼續')");
    expect(source).toContain("text.includes('/auth/google?plan=growth')");
    expect(source).toContain('get(\'/api/saas/signup/readiness\', { json: true })');
    expect(source).toContain('Object.keys(readiness).sort().join(\',\') === \'emailEnabled,phoneEnabled\'');
    expect(source).toContain('cacheControl.toLowerCase().includes(\'no-store\')');
    expect(source).toContain('signupText.includes(');
    expect(source).toContain('\'email-signup-unavailable-notice\'');
    expect(source).toMatch(/if \(expectAccountRegistration\) \{\s+await checkAccountRegistration\(\);/);
  });
});
