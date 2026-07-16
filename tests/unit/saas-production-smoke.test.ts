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

  it('requires an anonymous reset-password request to return to recovery', () => {
    expect(source).toContain("expectRedirect('/reset-password'");
    expect(source).toContain('/\\/forgot-password(?:\\?|$)/');
  });

  it('bounds every fetch, including response-body reads, with a cleared abort timer', () => {
    expect(source).toContain("--timeout-ms=");
    expect(source).toContain('SAAS_PRODUCTION_SMOKE_TIMEOUT_MS');
    expect(source).toContain('const controller = new AbortController()');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain('clearTimeout(timeout)');
    expect(source.indexOf('await response.text()')).toBeLessThan(source.indexOf('clearTimeout(timeout)'));
  });
});
