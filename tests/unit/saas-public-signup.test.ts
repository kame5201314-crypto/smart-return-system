import { describe, expect, it } from 'vitest';

import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

describe('SaaS public signup state', () => {
  it('keeps public signup closed by default', () => {
    expect(resolveSaaSPublicSignupState({})).toMatchObject({
      mode: 'closed_beta',
      isPublicSignupEnabled: false,
      statusLabel: '封閉 Beta',
      primaryCtaLabel: '聯絡 Beta 開通',
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
      statusLabel: '公開註冊開放中',
      primaryCtaLabel: '送出試用申請',
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
