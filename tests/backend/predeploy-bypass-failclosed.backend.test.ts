/* @vitest-environment node */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

interface Gate {
  name: string;
  script: string;
  bypassEnv: string;
  strictEnv?: string;
}

const GATES: Gate[] = [
  {
    name: 'schema-gate',
    script: 'scripts/predeploy/schema-gate.mjs',
    bypassEnv: 'SCHEMA_GATE_BYPASS',
    strictEnv: 'SCHEMA_GATE_STRICT',
  },
  {
    name: 'supabase-project-check',
    script: 'scripts/predeploy/check-supabase-project.mjs',
    bypassEnv: 'SUPABASE_PROJECT_CHECK_BYPASS',
    strictEnv: 'SUPABASE_PROJECT_CHECK_STRICT',
  },
  {
    name: 'alert-config',
    script: 'scripts/predeploy/check-alert-config.mjs',
    bypassEnv: 'ALERT_CONFIG_BYPASS',
  },
  {
    name: 'branch-policy',
    script: 'scripts/predeploy/check-branch-policy.mjs',
    bypassEnv: 'BRANCH_POLICY_BYPASS',
    strictEnv: 'BRANCH_POLICY_STRICT',
  },
];

function runGate(script: string, overrides: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Clear deployment + strict/bypass signals so each case controls them explicitly.
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  for (const gate of GATES) {
    delete env[gate.bypassEnv];
    if (gate.strictEnv) delete env[gate.strictEnv];
  }
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [path.join(ROOT, script)], {
    env,
    encoding: 'utf8',
  });
}

describe('predeploy gate bypass is fail-closed in production', () => {
  for (const gate of GATES) {
    it(`${gate.name}: bypass fails closed under Vercel production`, () => {
      const res = runGate(gate.script, {
        VERCEL: '1',
        VERCEL_ENV: 'production',
        [gate.bypassEnv]: '1',
      });
      expect(res.status).toBe(1);
      expect(`${res.stderr}`).toMatch(/not allowed in production/i);
    });

    it(`${gate.name}: bypass is allowed (exit 0) in local/dev`, () => {
      const overrides: Record<string, string> = { [gate.bypassEnv]: '1' };
      if (gate.strictEnv) overrides[gate.strictEnv] = '0';
      const res = runGate(gate.script, overrides);
      expect(res.status).toBe(0);
      expect(`${res.stdout}${res.stderr}`).toMatch(/allowed in local\/dev only/i);
    });
  }
});
