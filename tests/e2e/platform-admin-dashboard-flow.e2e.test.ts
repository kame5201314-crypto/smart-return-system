/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import type { PlatformAdminDataRepository } from '@/lib/saas/platform-admin-data';
import { loadPlatformAdminDashboardView } from '@/lib/saas/platform-admin-live-data';

// Fixed "now" so trial day math is deterministic.
const NOW = new Date('2026-06-13T00:00:00.000Z');

function iso(date: string): string {
  return new Date(date).toISOString();
}

function platformAdminContext(): PlatformAdminContext {
  return {
    userId: 'admin-e2e',
    isPlatformAdmin: true,
    platformRole: 'owner',
    permissions: getPlatformAdminPermissions('owner'),
    featureFlags: resolveSaaSFeatureFlags({
      env: { ENABLE_MULTI_TENANT_ADMIN: 'true' },
      orgPlan: 'enterprise',
    }),
  };
}

/**
 * A realistic mixed-tenant platform:
 * - org-active:    Growth, active            -> MRR 699, healthy
 * - org-trial:     Growth, trialing, 2 days left -> pipeline 699, trial_ending
 * - org-pastdue:   Basic, past_due           -> riskLevel at_risk (billing)
 * - org-aifull:    Growth, active, AI limit  -> riskLevel at_risk (ai quota), still MRR 699
 * - org-expired:   Basic, trialing, expired  -> trial_expired (tracked by the trial
 *                  conversion funnel, NOT by subscription riskLevel — a still-trialing
 *                  org is not yet a billing/usage risk)
 */
function createMixedTenantRepository(): PlatformAdminDataRepository {
  const organizations = [
    {
      id: 'org-active',
      name: 'Active Brand',
      slug: 'active-brand',
      plan: 'growth' as const,
      status: 'active' as const,
      ownerEmail: 'active@example.com',
      memberCount: 4,
      createdAt: iso('2026-04-01'),
    },
    {
      id: 'org-trial',
      name: 'Trial Brand',
      slug: 'trial-brand',
      plan: 'growth' as const,
      status: 'trialing' as const,
      ownerEmail: 'trial@example.com',
      memberCount: 2,
      createdAt: iso('2026-06-01'),
    },
    {
      id: 'org-pastdue',
      name: 'Pastdue Brand',
      slug: 'pastdue-brand',
      plan: 'basic' as const,
      status: 'past_due' as const,
      ownerEmail: 'pastdue@example.com',
      memberCount: 1,
      createdAt: iso('2026-03-01'),
    },
    {
      id: 'org-aifull',
      name: 'AI Full Brand',
      slug: 'aifull-brand',
      plan: 'growth' as const,
      status: 'active' as const,
      ownerEmail: 'aifull@example.com',
      memberCount: 3,
      createdAt: iso('2026-02-01'),
    },
    {
      id: 'org-expired',
      name: 'Expired Trial Brand',
      slug: 'expired-brand',
      plan: 'basic' as const,
      status: 'trialing' as const,
      ownerEmail: 'expired@example.com',
      memberCount: 1,
      createdAt: iso('2026-05-01'),
    },
  ];

  const growthAiLimit = SAAS_PLAN_DEFINITIONS.growth.aiMonthlyLimit ?? 30;

  return {
    listOrganizations: vi.fn(async () => organizations),
    getOrganization: vi.fn(async () => null),
    listBillingEvents: vi.fn(async () => [
      {
        id: 'evt-paid',
        orgId: 'org-active',
        provider: 'ecpay' as const,
        eventType: 'period_paid',
        status: 'processed' as const,
        providerEventId: 'trade-paid',
        createdAt: iso('2026-06-10'),
      },
      {
        id: 'evt-fail',
        orgId: 'org-pastdue',
        provider: 'ecpay' as const,
        eventType: 'period_failed',
        status: 'failed' as const,
        providerEventId: 'trade-fail',
        createdAt: iso('2026-06-11'),
      },
      {
        id: 'evt-recv',
        orgId: 'org-active',
        provider: 'ecpay' as const,
        eventType: 'invoice_issued',
        status: 'received' as const,
        providerEventId: 'inv-1',
        createdAt: iso('2026-06-12'),
      },
    ]),
    listOrganizationUsage: vi.fn(async () => ({
      'org-active': { returnsThisMonth: 100, aiUsedThisMonth: 5 },
      'org-trial': { returnsThisMonth: 10, aiUsedThisMonth: 1 },
      'org-pastdue': { returnsThisMonth: 50, aiUsedThisMonth: 2 },
      'org-aifull': { returnsThisMonth: 200, aiUsedThisMonth: growthAiLimit },
      'org-expired': { returnsThisMonth: 5, aiUsedThisMonth: 0 },
    })),
    listOrganizationSubscriptions: vi.fn(async () => ({
      'org-active': {
        status: 'active' as const,
        currentPeriodEnd: iso('2026-07-01'),
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
      'org-trial': {
        status: 'trialing' as const,
        currentPeriodEnd: null,
        trialEnd: iso('2026-06-15'), // 2 days from NOW
        cancelAtPeriodEnd: false,
      },
      'org-pastdue': {
        status: 'past_due' as const,
        currentPeriodEnd: iso('2026-06-05'),
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
      'org-aifull': {
        status: 'active' as const,
        currentPeriodEnd: iso('2026-07-01'),
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
      'org-expired': {
        status: 'trialing' as const,
        currentPeriodEnd: null,
        trialEnd: iso('2026-06-08'), // already expired before NOW
        cancelAtPeriodEnd: false,
      },
    })),
    listOrganizationSelfServiceTrialClaims: vi.fn(async () => ({})),
    listOrganizationNames: vi.fn(async () => ({
      'org-active': 'Active Brand',
      'org-pastdue': 'Pastdue Brand',
    })),
    listAuditLogs: vi.fn(async () => []),
  };
}

describe('Platform admin dashboard e2e flow', () => {
  it('aggregates a mixed-tenant platform into correct KPIs, alerts, and trial pipeline', async () => {
    const repository = createMixedTenantRepository();

    const result = await loadPlatformAdminDashboardView({
      requireAccess: async () => platformAdminContext(),
      repository,
      now: NOW,
    });

    expect(result.state).toBe('ready');
    if (result.state !== 'ready') return;

    const data = result.data;
    const summary = data.organizations;

    // --- MRR: only active orgs count (growth 699 + growth 699) ---
    expect(summary.estimatedActiveMrrTwd).toBe(699 * 2);

    // --- Trial pipeline: only trialing orgs (growth 699 + basic 399) ---
    expect(summary.trialPipelineMrrTwd).toBe(699 + 399);

    // --- Active/trialing count: active(2) + trialing(2) = 4 of 5 ---
    expect(summary.activeOrTrialingOrganizations).toBe(4);
    expect(summary.trialingOrganizations).toBe(2);

    // --- At-risk KPI counts subscription/usage risk only: past_due + ai-full = 2.
    // An expired-but-still-trialing org is NOT a subscription risk; it is tracked
    // by the trial conversion funnel below. ---
    expect(summary.atRiskOrganizations).toBe(2);

    // --- AI limit reached: only org-aifull ---
    expect(summary.aiLimitReachedOrganizations).toBe(1);

    // --- Paused/past_due: only org-pastdue ---
    expect(summary.pausedOrPastDueOrganizations).toBe(1);

    // --- At-risk alerts surface billing, quota, AND trial alerts (ending + expired),
    // so this is broader than the riskLevel KPI. Affected orgs:
    // past_due, ai-full, expired-trial, trial-ending = 4. ---
    expect(data.atRisk.summary.totalAlerts).toBeGreaterThanOrEqual(4);
    expect(data.atRisk.summary.affectedOrganizations).toBe(4);

    // A critical alert (past_due / expired trial) should sort to the top.
    expect(data.atRisk.topAlerts.length).toBeGreaterThan(0);
    expect(data.atRisk.topAlerts[0].severity).toBe('critical');

    // --- Trial conversion: 1 ending soon, 1 expired ---
    expect(data.trialConversion.summary.trialEndingSoonOrganizations).toBe(1);
    expect(data.trialConversion.summary.expiredTrialOrganizations).toBe(1);

    // Follow-up list should include both trial orgs, expired sorted first.
    const followUpIds = data.trialConversion.followUpOrganizations.map((o) => o.orgId);
    expect(followUpIds).toContain('org-trial');
    expect(followUpIds).toContain('org-expired');

    // --- Billing events: 1 processed, 1 failed, 1 received ---
    expect(data.billingEvents.summary.totalEvents).toBe(3);
    expect(data.billingEvents.summary.processedEvents).toBe(1);
    expect(data.billingEvents.summary.failedEvents).toBe(1);
    expect(data.billingEvents.summary.receivedEvents).toBe(1);
    expect(data.billingEvents.recentEvents.length).toBe(3);
  });

  it('returns an empty platform dashboard when there are no tenants yet', async () => {
    const emptyRepository: PlatformAdminDataRepository = {
      ...createMixedTenantRepository(),
      listOrganizations: vi.fn(async () => []),
    };

    const result = await loadPlatformAdminDashboardView({
      requireAccess: async () => platformAdminContext(),
      repository: emptyRepository,
      now: NOW,
    });

    // No tenants -> loader short-circuits to empty before dependent queries.
    expect(result.state).toBe('empty');
    expect(emptyRepository.listOrganizationUsage).not.toHaveBeenCalled();
  });
});
