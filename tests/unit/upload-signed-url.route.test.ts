/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadSessionToken } from '@/lib/upload/security';

const createSignedUploadUrlMock = vi.fn();
const getPublicUrlMock = vi.fn();
const TEST_SECRET = 'upload-session-secret-for-tests-1234567890';

process.env.UPLOAD_SESSION_SECRET = TEST_SECRET;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: createSignedUploadUrlMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

vi.mock('@/lib/saas/org-context', () => ({
  getOrgContext: vi.fn(async () => {
    throw new Error('No authenticated org context in anonymous upload tests');
  }),
}));

import { POST } from '@/app/api/v1/upload/signed-url/route';

function buildRequest(
  body: Record<string, unknown>,
  ip = '10.0.0.1'
): Request {
  return new Request('http://localhost/api/v1/upload/signed-url', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

function buildSession(draftId: string, orgId?: string): string {
  const tokenResult = createUploadSessionToken({ draftId, orgId });
  if (!tokenResult.token) {
    throw new Error('Failed to create test upload session token');
  }
  return tokenResult.token;
}

describe('POST /api/v1/upload/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSignedUploadUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed-url', token: 'upload-token' },
      error: null,
    });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://storage.example/public.jpg' },
    });
  });

  it('allows anonymous upload sign-url requests for supported image types', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5c';
    const sessionToken = buildSession(draftId);
    const response = await POST(buildRequest({
      fileName: 'product.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024,
      folder: 'product-photos',
      draftId,
      sessionToken,
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.signedUrl).toBe('https://storage.example/signed-url');
    expect(payload.publicUrl).toBe('https://storage.example/public.jpg');
    expect(createSignedUploadUrlMock).toHaveBeenCalledTimes(1);
    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(/^staging\/d7f16050-16d8-4d7f-ae4c-ec89b6a31f5c\/product-photos\/\d+_[a-f0-9]+\.(jpg|jpeg)$/)
    );
  });

  it('accepts HEIC uploads to match customer portal constraints', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5d';
    const sessionToken = buildSession(draftId);
    const response = await POST(buildRequest({
      fileName: 'phone.heic',
      fileType: 'image/heic',
      fileSize: 2048,
      folder: 'shipping-labels',
      draftId,
      sessionToken,
    }, '10.0.0.2') as never);

    expect(response.status).toBe(200);
    expect(createSignedUploadUrlMock).toHaveBeenCalledTimes(1);
  });

  it('scopes staging upload paths by org when the session carries org context', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f60';
    const orgId = '11111111-1111-4111-8111-111111111111';
    const sessionToken = buildSession(draftId, orgId);
    const response = await POST(buildRequest({
      fileName: 'product.jpg',
      fileType: 'image/jpeg',
      fileSize: 1024,
      folder: 'product-photos',
      draftId,
      sessionToken,
    }, '10.0.0.6') as never);

    expect(response.status).toBe(200);
    expect(createSignedUploadUrlMock).toHaveBeenCalledTimes(1);
    expect(createSignedUploadUrlMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^staging/${orgId}/${draftId}/product-photos/\\d+_[a-f0-9]+\\.(jpg|jpeg)$`))
    );
  });

  it('rejects unsupported file types', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5e';
    const sessionToken = buildSession(draftId);
    const response = await POST(buildRequest({
      fileName: 'script.svg',
      fileType: 'image/svg+xml',
      fileSize: 2048,
      folder: 'product-photos',
      draftId,
      sessionToken,
    }, '10.0.0.3') as never);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe('FILE_TYPE_INVALID');
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it('rejects invalid folder traversal attempts', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5f';
    const sessionToken = buildSession(draftId);
    const response = await POST(buildRequest({
      fileName: 'a.jpg',
      fileType: 'image/jpeg',
      fileSize: 100,
      folder: '../private',
      draftId,
      sessionToken,
    }, '10.0.0.4') as never);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe('FOLDER_INVALID');
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it('rejects request without upload session token', async () => {
    const response = await POST(buildRequest({
      fileName: 'a.jpg',
      fileType: 'image/jpeg',
      fileSize: 100,
      folder: 'product-photos',
      draftId: 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5a',
    }, '10.0.0.5') as never);

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe('MISSING_SESSION');
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });
});
