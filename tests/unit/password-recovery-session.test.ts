import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPasswordRecoverySessionToken,
  PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS,
  verifyPasswordRecoverySessionToken,
} from '@/lib/auth/password-recovery-session';

describe('password recovery session proof', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'test-password-recovery-secret');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('binds a short-lived signed proof to the verified user', async () => {
    const token = await createPasswordRecoverySessionToken('user-1');
    const payload = await verifyPasswordRecoverySessionToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.purpose).toBe('password_recovery');
  });

  it('rejects tampered and expired proofs', async () => {
    const token = await createPasswordRecoverySessionToken('user-1');
    expect(await verifyPasswordRecoverySessionToken(`${token}x`)).toBeNull();

    vi.advanceTimersByTime((PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS + 1) * 1000);
    expect(await verifyPasswordRecoverySessionToken(token)).toBeNull();
  });
});
