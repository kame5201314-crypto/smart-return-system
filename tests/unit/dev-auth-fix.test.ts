/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { isDevAuthFixAllowed } from '@/lib/security/dev-auth-fix';

describe('development auth repair gate', () => {
  it('rejects missing flags and every production-like app mode', () => {
    expect(isDevAuthFixAllowed({})).toBe(false);
    expect(isDevAuthFixAllowed({ APP_MODE: 'saas', ALLOW_DEV_AUTH_FIX: 'true' })).toBe(false);
    expect(isDevAuthFixAllowed({ APP_MODE: 'production', ALLOW_DEV_AUTH_FIX: 'true' })).toBe(false);
    expect(isDevAuthFixAllowed({ APP_MODE: 'internal', ALLOW_DEV_AUTH_FIX: 'true' })).toBe(false);
  });

  it('requires the explicit opt-in even in development modes', () => {
    expect(isDevAuthFixAllowed({ APP_MODE: 'development' })).toBe(false);
    expect(isDevAuthFixAllowed({ APP_MODE: 'local', ALLOW_DEV_AUTH_FIX: 'false' })).toBe(false);
  });

  it('allows only explicit development or local execution', () => {
    expect(isDevAuthFixAllowed({
      APP_MODE: ' development ',
      ALLOW_DEV_AUTH_FIX: ' TRUE ',
    })).toBe(true);
    expect(isDevAuthFixAllowed({ APP_MODE: 'local', ALLOW_DEV_AUTH_FIX: 'true' })).toBe(true);
  });
});
