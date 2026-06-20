/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdminSessionToken, verifyAdminSessionToken } from '@/lib/auth/admin-session';

const VALID_SECRET = 'admin-session-secret-for-tests-1234567890'; // >= 32 chars
const SHORT_SECRET = 'too-short-secret';
const SERVICE_ROLE_KEY = 'service-role-key-value-abcdefghijklmnopqrstuv';

describe('admin session secret (no service-role fallback, fail-closed)', () => {
  let originalAdmin: string | undefined;
  let originalServiceRole: string | undefined;

  beforeEach(() => {
    originalAdmin = process.env.ADMIN_SESSION_SECRET;
    originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (originalAdmin === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalAdmin;
    if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  });

  it('signs and verifies a token with a valid dedicated secret', async () => {
    process.env.ADMIN_SESSION_SECRET = VALID_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const token = await createAdminSessionToken('admin');
    const payload = await verifyAdminSessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.role).toBe('admin');
    expect(payload?.sub).toBe('admin');
  });

  it('refuses to issue a token when the secret is missing', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(createAdminSessionToken()).rejects.toThrow(/ADMIN_SESSION_SECRET/);
  });

  it('refuses to issue a token when the secret is too short', async () => {
    process.env.ADMIN_SESSION_SECRET = SHORT_SECRET;

    await expect(createAdminSessionToken()).rejects.toThrow(/at least 32/);
  });

  it('does not fall back to SUPABASE_SERVICE_ROLE_KEY', async () => {
    process.env.ADMIN_SESSION_SECRET = VALID_SECRET;
    const token = await createAdminSessionToken('admin');

    // Drop the dedicated secret but leave a >=32 service-role key present.
    // The token must NOT verify via the (now removed) fallback.
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

    const payload = await verifyAdminSessionToken(token);
    expect(payload).toBeNull();
  });

  it('verify fails closed (resolves null, does not throw) when the secret is absent', async () => {
    process.env.ADMIN_SESSION_SECRET = VALID_SECRET;
    const token = await createAdminSessionToken('admin');

    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(verifyAdminSessionToken(token)).resolves.toBeNull();
  });
});
