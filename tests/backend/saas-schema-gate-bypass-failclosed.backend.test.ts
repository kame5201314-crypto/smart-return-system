/* @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT = 'scripts/saas/check-saas-schema-readiness.mjs';
const BYPASS_ENV = 'SAAS_SCHEMA_GATE_BYPASS';
const STRICT_ENV = 'SAAS_SCHEMA_GATE_STRICT';

function runGate(overrides: Record<string, string>, args: string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Clear deployment + strict/bypass signals so each case controls them explicitly.
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  delete env[BYPASS_ENV];
  delete env[STRICT_ENV];
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [path.join(ROOT, SCRIPT), ...args], {
    env,
    encoding: 'utf8',
  });
}

describe('saas schema gate bypass is fail-closed in production/strict', () => {
  it('bypass fails closed under Vercel production', () => {
    const res = runGate({ VERCEL: '1', VERCEL_ENV: 'production', [BYPASS_ENV]: '1' });
    expect(res.status).toBe(1);
    expect(`${res.stderr}`).toMatch(/not allowed in production/i);
  });

  it('bypass fails closed when SAAS_SCHEMA_GATE_STRICT=1', () => {
    const res = runGate({ [STRICT_ENV]: '1', [BYPASS_ENV]: '1' });
    expect(res.status).toBe(1);
    expect(`${res.stderr}`).toMatch(/not allowed in production/i);
  });

  it('bypass fails closed under the --strict flag', () => {
    const res = runGate({ [BYPASS_ENV]: '1' }, ['--strict']);
    expect(res.status).toBe(1);
    expect(`${res.stderr}`).toMatch(/not allowed in production/i);
  });

  it('bypass is allowed (exit 0) in local/dev', () => {
    const res = runGate({ [BYPASS_ENV]: '1', [STRICT_ENV]: '0' });
    expect(res.status).toBe(0);
    expect(`${res.stdout}${res.stderr}`).toMatch(/allowed in local\/dev only/i);
  });
});
