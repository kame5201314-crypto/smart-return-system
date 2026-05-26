import { describe, expect, it } from 'vitest';

import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

describe('SaaS public signup state', () => {
  it('keeps public signup closed by default', () => {
    expect(resolveSaaSPublicSignupState({})).toMatchObject({
      mode: 'closed_beta',
      isPublicSignupEnabled: false,
      statusLabel: 'Beta 期 · 限額導入',
      primaryCtaLabel: '申請 Beta 試用',
    });
  });

  it('opens public signup only when the feature flag is enabled', () => {
    expect(
      resolveSaaSPublicSignupState({
        ENABLE_PUBLIC_SIGNUP: 'true',
      })
    ).toMatchObject({
      mode: 'public_signup',
      isPublicSignupEnabled: true,
      statusLabel: '開放試用',
      primaryCtaLabel: '立即開始試用',
    });
  });

  it('treats invalid flag values as closed beta', () => {
    expect(
      resolveSaaSPublicSignupState({
        ENABLE_PUBLIC_SIGNUP: 'later',
      })
    ).toMatchObject({
      mode: 'closed_beta',
      isPublicSignupEnabled: false,
    });
  });
});
