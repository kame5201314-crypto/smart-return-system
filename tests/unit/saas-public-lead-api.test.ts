/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleSaaSPublicLeadRequest } from '@/app/api/saas/leads/route';
import type { SaaSPublicLeadRepository } from '@/lib/saas/lead-capture-repository';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildPayload() {
  return {
    companyName: 'Demo Store',
    contactName: 'Owner',
    email: 'owner@example.com',
    preferredContactChannel: 'email',
    requestedPlan: 'growth',
    monthlyReturnBand: '101_300',
    privacyConsent: true,
  };
}

function createRepository(): SaaSPublicLeadRepository {
  return {
    createLead: vi.fn(async () => ({ id: 'lead-1' })),
  };
}

describe('SaaS public lead API', () => {
  it('stays closed independently from public signup', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicLeadRequest(buildRequest(buildPayload()), {
      env: { ENABLE_PUBLIC_SIGNUP: 'true' },
      repository,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature_disabled' });
    expect(repository.createLead).not.toHaveBeenCalled();
  });

  it('accepts and persists a valid lead when only lead capture is enabled', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicLeadRequest(buildRequest(buildPayload()), {
      env: { ENABLE_PUBLIC_LEAD_CAPTURE: 'true' },
      repository,
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { accepted: true, mode: 'public_lead', requestId: 'lead-1' },
    });
    expect(repository.createLead).toHaveBeenCalledOnce();
  });

  it('silently accepts honeypot submissions without persistence', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicLeadRequest(
      buildRequest({ website: 'https://bot.example' }),
      {
        env: { ENABLE_PUBLIC_LEAD_CAPTURE: 'true' },
        repository,
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { accepted: true, mode: 'public_lead', requestId: null },
    });
    expect(repository.createLead).not.toHaveBeenCalled();
  });

  it('does not accept public signup as a substitute for a contact method', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicLeadRequest(
      buildRequest({ ...buildPayload(), email: '', lineId: '', phone: '' }),
      {
        env: { ENABLE_PUBLIC_LEAD_CAPTURE: 'true' },
        repository,
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
    expect(repository.createLead).not.toHaveBeenCalled();
  });

  it('returns not configured when persistence cannot be created', async () => {
    const response = await handleSaaSPublicLeadRequest(buildRequest(buildPayload()), {
      env: { ENABLE_PUBLIC_LEAD_CAPTURE: 'true' },
      repository: () => {
        throw new Error('Missing Supabase credentials');
      },
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'not_configured' });
  });
});
