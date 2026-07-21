import { describe, expect, it } from 'vitest';

import { getPlatformOrganizationDisplayIdentity } from '@/lib/saas/platform-organization-display';

describe('getPlatformOrganizationDisplayIdentity', () => {
  it('uses the owner email as the only visible identity for Google self-service organizations', () => {
    expect(getPlatformOrganizationDisplayIdentity({
      name: 'Google QA Trial 20260715 1726',
      ownerEmail: 'owner@example.com',
      provisioningSource: 'google_self_service',
    })).toEqual({
      primaryLabel: 'owner@example.com',
      secondaryLabel: null,
    });
  });

  it('keeps the organization name and email for manually provisioned organizations', () => {
    expect(getPlatformOrganizationDisplayIdentity({
      name: '遇見未來',
      ownerEmail: 'owner@example.com',
      provisioningSource: 'manual',
    })).toEqual({
      primaryLabel: '遇見未來',
      secondaryLabel: 'owner@example.com',
    });
  });

  it('falls back to the organization name when a Google organization has no owner email', () => {
    expect(getPlatformOrganizationDisplayIdentity({
      name: '尚未完成帳號資料',
      ownerEmail: null,
      provisioningSource: 'google_self_service',
    })).toEqual({
      primaryLabel: '尚未完成帳號資料',
      secondaryLabel: null,
    });
  });
});
