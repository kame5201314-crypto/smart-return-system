import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/saas/check-saas-schema-readiness.mjs');

function readScriptSource(): string {
  return fs.readFileSync(scriptPath, 'utf8');
}

describe('SaaS schema readiness gate', () => {
  it('checks commercial v2 columns needed before live SaaS wiring', () => {
    const source = readScriptSource();

    for (const snippet of [
      "['organizations', 'onboarding_completed_at']",
      "['organizations', 'invoice_carrier']",
      "['organizations', 'suspended_at']",
      "['organizations', 'upgrade_suggested_at']",
      "['subscriptions', 'provider_subscription_id']",
      "['subscriptions', 'current_period_start']",
      "['subscriptions', 'current_period_end']",
      "['subscriptions', 'cancel_at_period_end']",
      "['subscriptions', 'canceled_at']",
      "['billing_events', 'processed_at']",
      "['organization_invites', 'token']",
      "['organization_invites', 'expires_at']",
      "['invoices', 'period_start']",
      "['invoices', 'period_end']",
      "['invoices', 'provider_invoice_id']",
      "['audit_logs', 'metadata']",
    ]) {
      expect(source).toContain(snippet);
    }
  });

  it('stays non-blocking in non-strict mode when SaaS DB env is not provided', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        APP_MODE: 'saas',
        NEXT_PUBLIC_SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        SAAS_SCHEMA_GATE_STRICT: 'false',
      },
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  });
});
