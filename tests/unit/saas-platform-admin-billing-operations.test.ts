/* @vitest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  handlePlatformBillingOperation,
} from '@/app/api/internal/saas/billing/operations/route';
import {
  buildPlatformBillingOperationRpcArgs,
  createPlatformBillingOperationsRepository,
  normalizePlatformBillingOperationRequest,
  PlatformBillingOperationError,
  type PlatformBillingOperationResult,
  type PlatformBillingOperationsRepository,
} from '@/lib/saas/platform-admin-billing-operations';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { ADMIN_UUID } from '@/lib/auth/admin-session';

const orgId = '11111111-1111-4111-8111-111111111111';
const actorUserId = '22222222-2222-4222-8222-222222222222';
const subscriptionId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const auditLogId = '55555555-5555-4555-8555-555555555555';
const billingEventId = '66666666-6666-4666-8666-666666666666';
const billingMigration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/033_saas_platform_billing_operations.sql'),
  'utf8'
);

const platformAdminContext: PlatformAdminContext = {
  userId: actorUserId,
  isPlatformAdmin: true,
  platformRole: 'owner',
  permissions: getPlatformAdminPermissions('owner'),
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

function buildJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/internal/saas/billing/operations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createRepository(): PlatformBillingOperationsRepository {
  return {
    performBillingOperation: vi.fn(async (input) => {
      const nextStatus = input.operation === 'suspend_org' ? ('suspended' as const) : ('active' as const);

      const result: PlatformBillingOperationResult = {
        operation: input.operation,
        orgId: input.orgId,
        subscriptionId,
        auditLogId,
        billingEventId: input.operation === 'suspend_org' || input.operation === 'resume_org'
          ? null
          : billingEventId,
        invoiceId: input.invoiceId,
        nextStatus,
      };
      return result;
    }),
  };
}

describe('SaaS platform admin billing operations', () => {
  it('keeps trial-to-paid activation atomic while preserving the selected plan', () => {
    const start = billingMigration.indexOf("IF p_operation = 'mark_manual_payment' THEN");
    const end = billingMigration.indexOf("ELSIF p_operation = 'suspend_org' THEN", start);
    const manualPaymentBlock = billingMigration.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(manualPaymentBlock).toContain("next_status := 'active'");
    expect(manualPaymentBlock).toContain('UPDATE public.organizations');
    expect(manualPaymentBlock).toContain('UPDATE public.subscriptions');
    expect(manualPaymentBlock).toContain("provider = 'manual'");
    expect(manualPaymentBlock).toContain('current_period_end = p_period_end');
    expect(manualPaymentBlock).toContain('cancel_at_period_end = false');
    expect(manualPaymentBlock).not.toMatch(/\bplan\s*=/);
  });

  it('normalizes manual payment requests and maps them to the RPC payload', () => {
    const input = normalizePlatformBillingOperationRequest(
      {
        operation: 'mark_manual_payment',
        orgId,
        amountTwd: 699,
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        paidAt: '2026-05-25T02:30:00.000Z',
        idempotencyKey: 'manual-payment-demo-202605',
        invoiceId,
        metadata: {
          source: 'bank_transfer',
        },
      },
      actorUserId,
      new Date('2026-05-25T00:00:00.000Z')
    );

    expect(input).toEqual({
      operation: 'mark_manual_payment',
      orgId,
      actorUserId,
      reason: null,
      amountTwd: 699,
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
      effectiveAt: '2026-05-25T02:30:00.000Z',
      idempotencyKey: 'manual-payment-demo-202605',
      invoiceId,
      metadata: {
        source: 'bank_transfer',
      },
    });
    expect(buildPlatformBillingOperationRpcArgs(input)).toEqual({
      p_operation: 'mark_manual_payment',
      p_org_id: orgId,
      p_actor_user_id: actorUserId,
      p_reason: null,
      p_amount_twd: 699,
      p_period_start: '2026-05-01T00:00:00.000Z',
      p_period_end: '2026-06-01T00:00:00.000Z',
      p_effective_at: '2026-05-25T02:30:00.000Z',
      p_idempotency_key: 'manual-payment-demo-202605',
      p_invoice_id: invoiceId,
      p_metadata: {
        source: 'bank_transfer',
      },
    });
  });

  it('keeps a legacy admin subject in metadata without writing a non-auth user foreign key', () => {
    const input = normalizePlatformBillingOperationRequest(
      {
        operation: 'mark_manual_payment',
        orgId,
        amountTwd: 699,
        periodEnd: '2026-06-01T00:00:00.000Z',
        idempotencyKey: 'legacy-admin-manual-payment-202605',
        metadata: {
          source: 'internal_org_detail',
          actorSubject: 'untrusted-client-value',
        },
      },
      ADMIN_UUID,
      new Date('2026-05-25T00:00:00.000Z')
    );

    expect(input.actorUserId).toBe(ADMIN_UUID);
    expect(buildPlatformBillingOperationRpcArgs(input)).toMatchObject({
      p_actor_user_id: null,
      p_metadata: {
        source: 'internal_org_detail',
        actorSubject: 'legacy_admin_session',
        actorPrincipalId: ADMIN_UUID,
      },
    });
  });

  it('normalizes suspend, resume, and refund operation contracts', () => {
    expect(
      normalizePlatformBillingOperationRequest(
        {
          operation: 'suspend_org',
          orgId,
          reason: 'past due more than 7 days',
        },
        actorUserId,
        new Date('2026-05-25T00:00:00.000Z')
      )
    ).toMatchObject({
      operation: 'suspend_org',
      amountTwd: null,
      periodEnd: null,
      reason: 'past due more than 7 days',
    });

    expect(
      normalizePlatformBillingOperationRequest(
        {
          operation: 'resume_org',
          orgId,
          reason: 'manual approval',
          periodEnd: '2026-06-30T00:00:00.000Z',
        },
        actorUserId,
        new Date('2026-05-25T00:00:00.000Z')
      )
    ).toMatchObject({
      operation: 'resume_org',
      periodEnd: '2026-06-30T00:00:00.000Z',
      reason: 'manual approval',
    });

    expect(
      normalizePlatformBillingOperationRequest(
        {
          operation: 'request_refund',
          orgId,
          amountTwd: 499,
          reason: '7-day refund policy review',
          invoiceId,
          idempotencyKey: 'refund-demo-202605',
        },
        actorUserId,
        new Date('2026-05-25T00:00:00.000Z')
      )
    ).toMatchObject({
      operation: 'request_refund',
      amountTwd: 499,
      invoiceId,
      idempotencyKey: 'refund-demo-202605',
      reason: '7-day refund policy review',
    });
  });

  it('requires a durable idempotency key for manual payments', () => {
    expect(() => normalizePlatformBillingOperationRequest(
      {
        operation: 'mark_manual_payment',
        orgId,
        amountTwd: 699,
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
      actorUserId,
      new Date('2026-05-25T00:00:00.000Z')
    )).toThrow('idempotencyKey is required.');
  });

  it('rejects invalid billing operation payloads before repository writes', () => {
    expect(() =>
      normalizePlatformBillingOperationRequest(
        {
          operation: 'suspend_org',
          orgId,
        },
        actorUserId
      )
    ).toThrow(PlatformBillingOperationError);

    expect(() =>
      normalizePlatformBillingOperationRequest(
        {
          operation: 'mark_manual_payment',
          orgId,
          amountTwd: 699,
          periodStart: '2026-06-01T00:00:00.000Z',
          periodEnd: '2026-05-01T00:00:00.000Z',
        },
        actorUserId
      )
    ).toThrow('periodEnd must be later than periodStart.');

    expect(() =>
      normalizePlatformBillingOperationRequest(
        {
          operation: 'mark_manual_payment',
          orgId,
          amountTwd: 699,
          paidAt: '2026-06-01T00:00:00.000Z',
          periodEnd: '2026-06-01T00:00:00.000Z',
        },
        actorUserId
      )
    ).toThrow('periodEnd must be later than effectiveAt.');
  });

  it('blocks operation access before reading or persisting when the platform flag is closed', async () => {
    const repository = createRepository();
    const response = await handlePlatformBillingOperation(
      new NextRequest('http://localhost/api/internal/saas/billing/operations', {
        method: 'POST',
        body: '{bad json',
      }),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'feature_disabled',
            403,
            'The multi-tenant admin feature flag is disabled.'
          );
        },
        repository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'feature_disabled',
    });
    expect(repository.performBillingOperation).not.toHaveBeenCalled();
  });

  it('blocks support-role billing operations before repository writes', async () => {
    const repository = createRepository();
    const response = await handlePlatformBillingOperation(
      buildJsonRequest({
        operation: 'mark_manual_payment',
        orgId,
        amountTwd: 699,
        effectiveAt: '2026-05-25T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        idempotencyKey: 'guarded-route-manual-payment-202605',
      }),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'permission_denied',
            403,
            'Platform admin permission is required: manage_billing_operations.'
          );
        },
        repository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'permission_denied',
    });
    expect(repository.performBillingOperation).not.toHaveBeenCalled();
  });

  it('performs platform billing operations through the guarded route', async () => {
    const repository = createRepository();
    const response = await handlePlatformBillingOperation(
      buildJsonRequest({
        operation: 'mark_manual_payment',
        orgId,
        amountTwd: 699,
        effectiveAt: '2026-05-25T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        idempotencyKey: 'successful-route-manual-payment-202605',
      }),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        operation: 'mark_manual_payment',
        orgId,
        subscriptionId,
        auditLogId,
        billingEventId,
        nextStatus: 'active',
      },
    });
    expect(repository.performBillingOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'mark_manual_payment',
        orgId,
        actorUserId,
        amountTwd: 699,
        periodEnd: '2026-06-01T00:00:00.000Z',
      })
    );
  });

  it('calls the platform billing operation RPC through the repository', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        operation: 'request_refund',
        org_id: orgId,
        subscription_id: subscriptionId,
        audit_log_id: auditLogId,
        billing_event_id: billingEventId,
        invoice_id: invoiceId,
        next_status: 'active',
      },
      error: null,
    }));
    const repository = createPlatformBillingOperationsRepository({ rpc });

    await expect(
      repository.performBillingOperation({
        operation: 'request_refund',
        orgId,
        actorUserId,
        reason: '7-day refund policy review',
        amountTwd: 499,
        periodStart: null,
        periodEnd: null,
        effectiveAt: '2026-05-25T00:00:00.000Z',
        idempotencyKey: 'refund-demo-202605',
        invoiceId,
        metadata: {},
      })
    ).resolves.toEqual({
      operation: 'request_refund',
      orgId,
      subscriptionId,
      auditLogId,
      billingEventId,
      invoiceId,
      nextStatus: 'active',
    });
    expect(rpc).toHaveBeenCalledWith('perform_platform_billing_operation_v2', {
      p_operation: 'request_refund',
      p_org_id: orgId,
      p_actor_user_id: actorUserId,
      p_reason: '7-day refund policy review',
      p_amount_twd: 499,
      p_period_start: null,
      p_period_end: null,
      p_effective_at: '2026-05-25T00:00:00.000Z',
      p_idempotency_key: 'refund-demo-202605',
      p_invoice_id: invoiceId,
      p_metadata: {},
    });
  });
});
