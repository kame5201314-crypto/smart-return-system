import { describe, expect, it, vi } from 'vitest';

import { normalizeSaaSPublicLead } from '@/lib/saas/lead-capture';
import {
  buildSaaSPublicLeadInsert,
  createSaaSPublicLeadRepository,
  type PublicLeadQueryClient,
} from '@/lib/saas/lead-capture-repository';

const lineLead = {
  companyName: '測試品牌',
  contactName: '王小明',
  lineId: '@demo',
  preferredContactChannel: 'line',
  requestedPlan: 'growth',
  monthlyReturnBand: '101_300',
  platform: '蝦皮',
  painPoint: '退貨資料分散',
  privacyConsent: true,
  attribution: {
    utmSource: 'meta',
    utmCampaign: 'beta-launch',
    ignored: 'drop-me',
  },
};

describe('SaaS public lead contract', () => {
  it('accepts a LINE-only Growth lead and whitelists attribution', () => {
    expect(normalizeSaaSPublicLead(lineLead)).toEqual({
      companyName: '測試品牌',
      contactName: '王小明',
      email: undefined,
      lineId: '@demo',
      phone: undefined,
      preferredContactChannel: 'line',
      requestedPlan: 'growth',
      monthlyReturnBand: '101_300',
      platform: '蝦皮',
      painPoint: '退貨資料分散',
      privacyConsent: true,
      attribution: {
        utmSource: 'meta',
        utmMedium: undefined,
        utmCampaign: 'beta-launch',
        utmContent: undefined,
        utmTerm: undefined,
        landingPath: undefined,
        referrer: undefined,
      },
    });
  });

  it('requires at least one contact method and privacy consent', () => {
    expect(() => normalizeSaaSPublicLead({ ...lineLead, lineId: undefined })).toThrow(
      /contact method/
    );
    expect(() => normalizeSaaSPublicLead({ ...lineLead, privacyConsent: false })).toThrow(
      /privacyConsent/
    );
  });

  it('requires the preferred contact value to exist', () => {
    expect(() =>
      normalizeSaaSPublicLead({ ...lineLead, preferredContactChannel: 'email' })
    ).toThrow(/requires email/);
  });

  it('maps normalized lead data to signup_requests without inventing exact volume', () => {
    const input = normalizeSaaSPublicLead(lineLead);
    expect(buildSaaSPublicLeadInsert(input)).toEqual({
      company_name: '測試品牌',
      contact_name: '王小明',
      email: null,
      line_id: '@demo',
      phone: null,
      preferred_contact_channel: 'line',
      plan: 'growth',
      monthly_return_volume: null,
      monthly_return_band: '101_300',
      message: '退貨資料分散',
      status: 'pending',
      source: 'public_lead',
      metadata: {
        platform: '蝦皮',
        privacyConsent: true,
        privacyConsentVersion: '2026-07-14',
        attribution: {
          utmSource: 'meta',
          utmCampaign: 'beta-launch',
        },
      },
    });
  });

  it('persists through the service-role repository contract', async () => {
    const single = vi.fn(async () => ({ data: { id: 'lead-1' }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const repository = createSaaSPublicLeadRepository({ from } satisfies PublicLeadQueryClient);

    await expect(repository.createLead(normalizeSaaSPublicLead(lineLead))).resolves.toEqual({
      id: 'lead-1',
    });
    expect(from).toHaveBeenCalledWith('signup_requests');
    expect(insert).toHaveBeenCalledOnce();
  });
});
