/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  handleSaaSEmailQueueCron,
} from '@/app/api/cron/saas/email-queue/route';
import {
  buildSaaSEmailQueueWorkerPreview,
  createSaaSEmailQueueWorkerRepository,
  type SaaSEmailQueueWorkerQueryClient,
  type SaaSEmailQueueWorkerRecord,
} from '@/lib/saas/email-queue-worker';

const orgId = '11111111-1111-4111-8111-111111111111';
const emailQueueId = '22222222-2222-4222-8222-222222222222';

function buildRecord(overrides: Partial<SaaSEmailQueueWorkerRecord> = {}): SaaSEmailQueueWorkerRecord {
  return {
    id: emailQueueId,
    orgId,
    recipientEmail: 'owner@example.com',
    templateKey: 'billing.payment_failed',
    subject: 'Payment failed for your Smart Return account',
    eventType: 'billing_payment_failed',
    payload: {},
    status: 'queued',
    sendAfter: null,
    attemptCount: 0,
    createdAt: '2026-05-25T00:00:00.000Z',
    ...overrides,
  };
}

function buildRequest(url = 'http://localhost/api/cron/saas/email-queue?dryRun=true') {
  return new Request(url, {
    headers: {
      authorization: 'Bearer test-cron-secret',
    },
  });
}

describe('SaaS email queue worker dry-run contract', () => {
  it('builds a dry-run preview without enabling delivery providers', () => {
    const preview = buildSaaSEmailQueueWorkerPreview(
      [
        buildRecord(),
        buildRecord({
          id: '33333333-3333-4333-8333-333333333333',
          attemptCount: 3,
        }),
        buildRecord({
          id: '44444444-4444-4444-8444-444444444444',
          sendAfter: '2026-05-26T00:00:00.000Z',
        }),
      ],
      {
        now: new Date('2026-05-25T00:00:00.000Z'),
        maxAttempts: 3,
        deliveryProviderEnabled: false,
      }
    );

    expect(preview).toMatchObject({
      checkedAt: '2026-05-25T00:00:00.000Z',
      deliveryProviderEnabled: false,
      dryRunOnly: true,
      summary: {
        scanned: 3,
        sendable: 0,
        blocked: 3,
        maxAttempts: 3,
      },
    });
    expect(preview.decisions.map((decision) => decision.blockedReason)).toEqual([
      'delivery_provider_not_configured',
      'max_attempts_exceeded',
      'not_due',
    ]);
    expect(preview.decisions.every((decision) => decision.dryRunOnly)).toBe(true);
  });

  it('queries due queued email records through the repository', async () => {
    const then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            {
              id: emailQueueId,
              org_id: orgId,
              recipient_email: 'owner@example.com',
              template_key: 'billing.payment_failed',
              subject: 'Payment failed for your Smart Return account',
              event_type: 'billing_payment_failed',
              payload: {
                invoiceId: 'invoice-1',
              },
              status: 'queued',
              send_after: null,
              attempt_count: 0,
              created_at: '2026-05-25T00:00:00.000Z',
            },
          ],
          error: null,
        })
      )
    );
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      or: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then,
    };
    const client = {
      from: vi.fn(() => query),
    } satisfies SaaSEmailQueueWorkerQueryClient;
    const repository = createSaaSEmailQueueWorkerRepository(client);

    await expect(
      repository.listDueEmailQueue({
        now: '2026-05-25T00:00:00.000Z',
        limit: 25,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: emailQueueId,
        orgId,
        recipientEmail: 'owner@example.com',
        eventType: 'billing_payment_failed',
      }),
    ]);
    expect(client.from).toHaveBeenCalledWith('email_queue');
    expect(query.eq).toHaveBeenCalledWith('status', 'queued');
    expect(query.or).toHaveBeenCalledWith('send_after.is.null,send_after.lte.2026-05-25T00:00:00.000Z');
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('blocks cron access before reading the queue when the bearer token is wrong', async () => {
    const repository = {
      listDueEmailQueue: vi.fn(async () => [buildRecord()]),
    };
    const response = await handleSaaSEmailQueueCron(
      new Request('http://localhost/api/cron/saas/email-queue', {
        headers: {
          authorization: 'Bearer wrong',
        },
      }),
      {
        env: {
          CRON_SECRET: 'test-cron-secret',
        },
        repository,
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Unauthorized',
    });
    expect(repository.listDueEmailQueue).not.toHaveBeenCalled();
  });

  it('rejects non-dry-run cron requests because delivery is not wired', async () => {
    const repository = {
      listDueEmailQueue: vi.fn(async () => [buildRecord()]),
    };
    const response = await handleSaaSEmailQueueCron(
      buildRequest('http://localhost/api/cron/saas/email-queue?dryRun=false'),
      {
        env: {
          CRON_SECRET: 'test-cron-secret',
        },
        repository,
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'delivery_not_enabled',
    });
    expect(repository.listDueEmailQueue).not.toHaveBeenCalled();
  });

  it('returns dry-run queue decisions from the cron route without sending email', async () => {
    const repository = {
      listDueEmailQueue: vi.fn(async () => [buildRecord()]),
    };
    const response = await handleSaaSEmailQueueCron(buildRequest(), {
      env: {
        CRON_SECRET: 'test-cron-secret',
        SAAS_EMAIL_QUEUE_DRY_RUN_LIMIT: '10',
      },
      now: new Date('2026-05-25T00:00:00.000Z'),
      repository,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        dryRunOnly: true,
        summary: {
          scanned: 1,
          sendable: 0,
          blocked: 1,
        },
        decisions: [
          {
            emailQueueId,
            blockedReason: 'delivery_provider_not_configured',
            dryRunOnly: true,
          },
        ],
      },
    });
    expect(repository.listDueEmailQueue).toHaveBeenCalledWith({
      now: '2026-05-25T00:00:00.000Z',
      limit: 10,
    });
  });
});
