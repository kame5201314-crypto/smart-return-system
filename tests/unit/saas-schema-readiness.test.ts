import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  checkBillingFunctions,
  resolveConditionalSchemaRequirements,
} from '../../scripts/saas/check-saas-schema-readiness.mjs';

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
      "['billing_events', 'status']",
      "['billing_events', 'processed_at']",
      "['organization_invites', 'token']",
      "['organization_invites', 'status']",
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

  it.each([
    ['ENABLE_BILLING', { ENABLE_BILLING: 'true' }],
    ['ENABLE_SUBSCRIPTION_PLAN', { ENABLE_SUBSCRIPTION_PLAN: 'true' }],
  ])('requires billing tables and core columns when %s is enabled', (_label, env) => {
    const result = resolveConditionalSchemaRequirements(env);

    expect(result.billingSchemaExpected).toBe(true);
    expect(result.tablesToCheck).toEqual(
      expect.arrayContaining(['payment_orders', 'subscription_periods'])
    );
    expect(result.columnsToCheck).toEqual(
      expect.arrayContaining([
        ['organizations', 'suspension_source'],
        ['payment_orders', 'provider_mode'],
        ['payment_orders', 'merchant_trade_no'],
        ['payment_orders', 'amount_twd'],
        ['payment_orders', 'status'],
        ['subscription_periods', 'payment_order_id'],
        ['subscription_periods', 'period_start'],
        ['subscription_periods', 'period_end'],
      ])
    );
  });

  it('keeps billing schema checks out of the existing disabled path', () => {
    const result = resolveConditionalSchemaRequirements({
      ENABLE_BILLING: 'false',
      ENABLE_SUBSCRIPTION_PLAN: 'false',
    });

    expect(result.billingSchemaExpected).toBe(false);
    expect(result.tablesToCheck).not.toContain('payment_orders');
    expect(result.tablesToCheck).not.toContain('subscription_periods');
    expect(result.columnsToCheck).not.toContainEqual(['payment_orders', 'status']);
  });

  it('treats billing RPC business errors as proof of existence without writing', async () => {
    const rpc = vi.fn(async () => ({
      error: { message: 'active owner or admin membership is required' },
    }));

    await expect(checkBillingFunctions({ rpc })).resolves.toEqual([]);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'create_self_service_payment_order',
      expect.objectContaining({
        p_org_id: null,
        p_actor_user_id: null,
        p_amount_twd: null,
        p_merchant_trade_no: '',
      })
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'process_ecpay_payment_notification',
      expect.objectContaining({
        p_merchant_trade_no: '',
        p_provider_event_id: '',
        p_provider_mode: '',
        p_trade_amount_twd: null,
      })
    );
  });

  it('fails billing RPC probes only for missing schema responses', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          message:
            'Could not find the function public.create_self_service_payment_order in the schema cache',
        },
      })
      .mockResolvedValueOnce({
        error: { message: 'merchant_trade_no and provider_event_id are required' },
      });

    await expect(checkBillingFunctions({ rpc })).resolves.toEqual([
      expect.objectContaining({
        functionName: 'create_self_service_payment_order',
        reason: 'missing_function',
      }),
    ]);
  });
});
