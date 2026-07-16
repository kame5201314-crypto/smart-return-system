import { describe, expect, it } from 'vitest';

import { resolveSignupMethodLabel } from '@/lib/auth/signup-presentation';

describe('signup presentation', () => {
  it('describes only registration methods that are actually enabled', () => {
    expect(resolveSignupMethodLabel({
      googleEnabled: true,
      emailEnabled: false,
      phoneEnabled: false,
    })).toBe('Google');

    expect(resolveSignupMethodLabel({
      googleEnabled: false,
      emailEnabled: true,
      phoneEnabled: true,
    })).toBe('電子信箱驗證碼或台灣手機驗證碼');

    expect(resolveSignupMethodLabel({
      googleEnabled: true,
      emailEnabled: true,
      phoneEnabled: true,
    })).toBe('Google、電子信箱驗證碼或台灣手機驗證碼');
  });

  it('returns no registration method when self-service signup is closed', () => {
    expect(resolveSignupMethodLabel({
      googleEnabled: false,
      emailEnabled: false,
      phoneEnabled: false,
    })).toBeNull();
  });
});
