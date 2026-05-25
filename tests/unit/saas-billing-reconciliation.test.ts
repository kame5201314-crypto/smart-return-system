/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  handleDryRunPlatformBillingEventRetry,
} from '@/app/api/internal/saas/billing/events/[id]/retry/route';
import {
  buildBillingEventReconciliationView,
  buildBillingEventRetryDecision,
  type BillingEventRetrySource,
} from '@/lib/saas/billing-reconciliation';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

const eventId = '11111111-1111-4111-8111-111111111111';
const orgId = '22222222-2222-4222-8222-222222222222';

const platformAdminContext: PlatformAdminContext = {
  userId: 'admin-1',
  isPlatformAdmin: true,
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

function buildEvent(overrides: Partial<BillingEventRetrySource> = {}): BillingEventRetrySource {
  return {
    id: eventId,
    orgId,
    provider: 'ecpay',
    eventType: 'ecpay.payment_succeeded',
    status: 'failed',
    providerEventId: 'provider-event-1',
    createdAt: '2026-05-24T00:00:00.000Z',
    ...overrides,
  };
}

function buildRequest(body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/internal/saas/billing/events/${eventId}/retry`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('SaaS billing retry and reconciliation', () => {
  it('keeps provider replay disabled by default even for retryable failed events', () => {
    expect(buildBillingEventRetryDecision(buildEvent())).toMatchObject({
      eventId,
      provider: 'ecpay',
      status: 'failed',
      retryEnabled: false,
      canRetry: false,
      dryRunOnly: true,
      blockedReason: 'provider_replay_not_enabled',
      operation: 'no_op',
    });
  });

  it('allows future provider replay only when explicitly enabled', () => {
    expect(
      buildBillingEventRetryDecision(buildEvent(), {
        providerReplayEnabled: true,
      })
    ).toMatchObject({
      retryEnabled: true,
      canRetry: true,
      dryRunOnly: false,
      blockedReason: null,
      operation: 'provider_webhook_replay',
    });
  });

  it('blocks processed, manual, and missing-provider-id events from retry', () => {
    expect(
      buildBillingEventRetryDecision(buildEvent({ status: 'processed' }))
    ).toMatchObject({
      blockedReason: 'already_processed',
    });
    expect(
      buildBillingEventRetryDecision(buildEvent({
        provider: 'manual',
        eventType: 'manual.payment_marked',
      }))
    ).toMatchObject({
      blockedReason: 'unsupported_provider',
    });
    expect(
      buildBillingEventRetryDecision(buildEvent({ providerEventId: null }))
    ).toMatchObject({
      blockedReason: 'missing_provider_event_id',
    });
  });

  it('builds a reconciliation view for local failures, stale received events, duplicates, and missing provider events', () => {
    const view = buildBillingEventReconciliationView(
      [
        buildEvent({ id: '11111111-1111-4111-8111-111111111111', status: 'failed' }),
        buildEvent({
          id: '33333333-3333-4333-8333-333333333333',
          status: 'received',
          providerEventId: 'provider-event-2',
          createdAt: '2026-05-23T00:00:00.000Z',
        }),
        buildEvent({
          id: '44444444-4444-4444-8444-444444444444',
          status: 'received',
          providerEventId: 'provider-event-2',
          createdAt: '2026-05-23T00:00:00.000Z',
        }),
      ],
      [
        {
          provider: 'ecpay',
          providerEventId: 'provider-event-3',
          eventType: 'ecpay.payment_succeeded',
          occurredAt: '2026-05-24T00:00:00.000Z',
          orgId,
        },
      ],
      {
        now: new Date('2026-05-25T00:00:00.000Z'),
        providerSnapshotComplete: true,
      }
    );

    expect(view.summary).toMatchObject({
      localEvents: 3,
      providerEvents: 1,
      issues: 7,
      criticalIssues: 2,
      warningIssues: 3,
      retryCandidates: 3,
    });
    expect(view.issues.map((issue) => issue.type)).toEqual(
      expect.arrayContaining([
        'local_failed',
        'local_unprocessed',
        'duplicate_local_event',
        'missing_local_event',
        'missing_provider_event',
      ])
    );
  });

  it('requires dry-run mode for the platform retry route', async () => {
    const repository = {
      getBillingEvent: vi.fn(async () => buildEvent()),
    };
    const response = await handleDryRunPlatformBillingEventRetry(
      buildRequest({ dryRun: false }),
      { params: Promise.resolve({ id: eventId }) },
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'retry_not_enabled',
    });
    expect(repository.getBillingEvent).not.toHaveBeenCalled();
  });

  it('blocks retry dry-run access before loading billing events when the platform flag is closed', async () => {
    const repository = {
      getBillingEvent: vi.fn(async () => buildEvent()),
    };
    const response = await handleDryRunPlatformBillingEventRetry(
      buildRequest({ dryRun: true }),
      { params: Promise.resolve({ id: eventId }) },
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
    expect(repository.getBillingEvent).not.toHaveBeenCalled();
  });

  it('returns retry eligibility for platform admins without replaying provider events', async () => {
    const repository = {
      getBillingEvent: vi.fn(async () => buildEvent()),
    };
    const response = await handleDryRunPlatformBillingEventRetry(
      buildRequest({ dryRun: true }),
      { params: Promise.resolve({ id: eventId }) },
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        eventId,
        retryEnabled: false,
        canRetry: false,
        dryRunOnly: true,
        blockedReason: 'provider_replay_not_enabled',
      },
    });
    expect(repository.getBillingEvent).toHaveBeenCalledWith({ eventId });
  });
});
