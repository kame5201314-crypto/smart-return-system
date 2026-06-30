/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  buildAIQuotaReachedNotification,
  buildBillingPaymentFailedNotification,
  buildPlatformAnnouncementNotification,
  buildSaaSNotificationDispatch,
  buildTrialEndingNotification,
  createSaaSNotificationQueueRepository,
  type SaaSNotificationQueueClient,
} from '@/lib/saas/notifications';

const orgId = '11111111-1111-4111-8111-111111111111';
const ownerUserId = '22222222-2222-4222-8222-222222222222';
const adminUserId = '33333333-3333-4333-8333-333333333333';

describe('SaaS notification queue foundation', () => {
  it('builds billing failure in-app notifications and queued email records', () => {
    const dispatch = buildBillingPaymentFailedNotification({
      orgId,
      invoiceId: '44444444-4444-4444-8444-444444444444',
      provider: 'ecpay',
      amountTwd: 699,
      failedAt: '2026-05-25T02:30:00.000Z',
      actionUrl: '/settings/billing',
      recipients: [
        {
          userId: ownerUserId,
          email: 'OWNER@EXAMPLE.COM',
          role: 'owner',
        },
        {
          email: 'billing@example.com',
          role: 'billing',
          channels: ['email'],
        },
      ],
    });

    expect(dispatch.eventType).toBe('billing_payment_failed');
    expect(dispatch.notifications).toHaveLength(1);
    expect(dispatch.notifications[0]).toMatchObject({
      org_id: orgId,
      user_id: ownerUserId,
      notification_type: 'billing_payment_failed',
      title: 'Payment failed',
      action_url: '/settings/billing',
    });
    expect(dispatch.emailQueue).toHaveLength(2);
    expect(dispatch.emailQueue.map((row) => row.recipient_email)).toEqual([
      'owner@example.com',
      'billing@example.com',
    ]);
    expect(dispatch.emailQueue[0]).toMatchObject({
      template_key: 'billing.payment_failed',
      event_type: 'billing_payment_failed',
      status: 'queued',
      payload: {
        provider: 'ecpay',
        amountTwd: 699,
        action_url: '/settings/billing',
      },
    });
  });

  it('builds AI quota reached notifications with quota payload and idempotency keys', () => {
    const dispatch = buildAIQuotaReachedNotification({
      orgId,
      used: 30,
      limit: 30,
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
      recipients: [
        {
          userId: ownerUserId,
          email: 'owner@example.com',
          channels: ['in_app', 'email'],
        },
      ],
    });

    expect(dispatch.notifications).toHaveLength(1);
    expect(dispatch.emailQueue).toHaveLength(1);
    expect(dispatch.notifications[0]).toMatchObject({
      notification_type: 'ai_quota_reached',
      metadata: {
        used: 30,
        limit: 30,
      },
    });
    expect(dispatch.emailQueue[0]).toMatchObject({
      template_key: 'usage.ai_quota_reached',
      idempotency_key: expect.stringContaining(':ai_quota_reached:email:'),
      payload: {
        used: 30,
        limit: 30,
      },
    });
  });

  it('builds trial ending and platform announcement queue records', () => {
    const trial = buildTrialEndingNotification({
      orgId,
      trialEnd: '2026-05-31T00:00:00.000Z',
      daysUntilTrialEnd: 6,
      recipients: [
        {
          userId: ownerUserId,
          email: 'owner@example.com',
        },
      ],
    });
    const announcement = buildPlatformAnnouncementNotification({
      orgId,
      title: 'Scheduled maintenance',
      message: 'The platform will have a planned maintenance window.',
      announcementId: 'maint-2026-05',
      sendAfter: '2026-05-26T01:00:00.000Z',
      recipients: [
        {
          userId: adminUserId,
          email: 'admin@example.com',
        },
      ],
    });

    expect(trial.emailQueue[0]).toMatchObject({
      template_key: 'trial.ending',
      payload: {
        trialEnd: '2026-05-31T00:00:00.000Z',
        daysUntilTrialEnd: 6,
      },
    });
    expect(announcement.notifications[0]).toMatchObject({
      title: 'Scheduled maintenance',
      message: 'The platform will have a planned maintenance window.',
      notification_type: 'platform_announcement',
    });
    expect(announcement.emailQueue[0]).toMatchObject({
      template_key: 'platform.announcement',
      send_after: '2026-05-26T01:00:00.000Z',
    });
  });

  it('rejects invalid recipients before building queue rows', () => {
    expect(() =>
      buildSaaSNotificationDispatch({
        eventType: 'billing_payment_failed',
        orgId,
        recipients: [
          {
            email: 'not-an-email',
          },
        ],
      })
    ).toThrow('recipient.email must be a valid email address.');

    expect(() =>
      buildSaaSNotificationDispatch({
        eventType: 'billing_payment_failed',
        orgId: 'not-a-uuid',
        recipients: [
          {
            email: 'owner@example.com',
          },
        ],
      })
    ).toThrow('orgId must be a valid UUID.');
  });

  it('persists queued notifications through Supabase without sending email', async () => {
    const inserted: Record<string, Record<string, unknown>[]> = {};
    const select = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn((table: string) => ({
        insert: vi.fn((values: Record<string, unknown>[]) => {
          inserted[table] = values;
          return { select };
        }),
      })),
    } satisfies SaaSNotificationQueueClient;
    const dispatch = buildBillingPaymentFailedNotification({
      orgId,
      invoiceId: '44444444-4444-4444-8444-444444444444',
      recipients: [
        {
          userId: ownerUserId,
          email: 'owner@example.com',
        },
      ],
    });

    const repository = createSaaSNotificationQueueRepository(client);
    const result = await repository.enqueue(dispatch);

    expect(result).toEqual({
      notificationCount: 1,
      emailQueueCount: 1,
    });
    expect(client.from).toHaveBeenCalledWith('notifications');
    expect(client.from).toHaveBeenCalledWith('email_queue');
    expect(inserted.notifications[0]).toMatchObject({
      org_id: orgId,
      user_id: ownerUserId,
      notification_type: 'billing_payment_failed',
    });
    expect(inserted.email_queue[0]).toMatchObject({
      org_id: orgId,
      recipient_email: 'owner@example.com',
      status: 'queued',
    });
    expect(select).toHaveBeenCalledWith('id');
  });

  it('surfaces queue insert failures for operator review', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(async () => ({
            error: {
              message: 'relation "email_queue" does not exist',
            },
          })),
        })),
      })),
    } satisfies SaaSNotificationQueueClient;
    const repository = createSaaSNotificationQueueRepository(client);

    await expect(
      repository.enqueue(
        buildBillingPaymentFailedNotification({
          orgId,
          recipients: [
            {
              email: 'billing@example.com',
              channels: ['email'],
            },
          ],
        })
      )
    ).rejects.toThrow(/email_queue/);
  });
});
