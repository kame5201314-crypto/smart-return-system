/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUploadSessionToken, verifyUploadSessionToken } from '@/lib/upload/security';

const VALID_SECRET = 'upload-session-secret-for-tests-1234567890'; // >= 32 chars
const SHORT_SECRET = 'short-secret';
const ADMIN_SECRET = 'admin-session-secret-fallback-attempt-123456';
const SERVICE_ROLE_KEY = 'service-role-key-fallback-attempt-1234567890';
const DRAFT_ID = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5c';

describe('upload session secret (no admin/service-role fallback, fail-closed)', () => {
  let originalUpload: string | undefined;
  let originalAdmin: string | undefined;
  let originalServiceRole: string | undefined;

  beforeEach(() => {
    originalUpload = process.env.UPLOAD_SESSION_SECRET;
    originalAdmin = process.env.ADMIN_SESSION_SECRET;
    originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (originalUpload === undefined) delete process.env.UPLOAD_SESSION_SECRET;
    else process.env.UPLOAD_SESSION_SECRET = originalUpload;
    if (originalAdmin === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = originalAdmin;
    if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  });

  it('signs and verifies with a valid dedicated secret', () => {
    process.env.UPLOAD_SESSION_SECRET = VALID_SECRET;

    const { token } = createUploadSessionToken({ draftId: DRAFT_ID });
    expect(token).toBeTypeOf('string');

    const result = verifyUploadSessionToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.draftId).toBe(DRAFT_ID);
  });

  it('refuses to issue a token when the secret is missing', () => {
    delete process.env.UPLOAD_SESSION_SECRET;
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { token, error } = createUploadSessionToken({ draftId: DRAFT_ID });
    expect(token).toBeNull();
    expect(error).toMatch(/not configured/i);
  });

  it('refuses to issue a token when the secret is too short', () => {
    process.env.UPLOAD_SESSION_SECRET = SHORT_SECRET;

    const { token } = createUploadSessionToken({ draftId: DRAFT_ID });
    expect(token).toBeNull();
  });

  it('does not fall back to ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY', () => {
    delete process.env.UPLOAD_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

    const { token, error } = createUploadSessionToken({ draftId: DRAFT_ID });
    expect(token).toBeNull();
    expect(error).toMatch(/not configured/i);
  });

  it('verify fails closed when the dedicated secret is removed', () => {
    process.env.UPLOAD_SESSION_SECRET = VALID_SECRET;
    const { token } = createUploadSessionToken({ draftId: DRAFT_ID });

    // Remove the dedicated secret but leave tempting >=32 fallbacks present.
    delete process.env.UPLOAD_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;

    const result = verifyUploadSessionToken(token);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('SERVER_CONFIG_ERROR');
  });
});
