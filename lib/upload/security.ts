import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_VERSION = 1;

export const UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_MAX_TOTAL_FILES = 7;
export const UPLOAD_SESSION_TTL_SECONDS = 20 * 60;
export const UPLOAD_ALLOWED_FOLDERS = ['product-photos', 'shipping-labels'] as const;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedImageMimeType = typeof ALLOWED_IMAGE_MIME_TYPES[number];

export interface UploadSessionPayload {
  v: number;
  draftId: string;
  orgId?: string;
  iat: number;
  exp: number;
  maxFiles: number;
  maxFileSizeBytes: number;
  allowedFolders: string[];
}

interface UploadSessionVerificationResult {
  valid: boolean;
  payload?: UploadSessionPayload;
  code?: string;
  error?: string;
}

const UPLOAD_SESSION_SECRET_MIN_LENGTH = 32;

function getUploadSessionSecret(): string | null {
  // Fail closed: only a dedicated UPLOAD_SESSION_SECRET is accepted. There is no
  // fallback to ADMIN_SESSION_SECRET or the service-role key, so a single leaked
  // secret can never be reused to forge upload sessions.
  const secret = (process.env.UPLOAD_SESSION_SECRET || '').trim();
  if (!secret || secret.length < UPLOAD_SESSION_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function signPayload(payloadB64: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(payloadB64).digest();
  return bytesToBase64Url(signature);
}

function secureEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function createUploadSessionToken(input: {
  draftId: string;
  orgId?: string;
  ttlSeconds?: number;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  allowedFolders?: string[];
}): { token: string | null; payload?: UploadSessionPayload; error?: string } {
  const secret = getUploadSessionSecret();
  if (!secret) {
    return {
      token: null,
      error: 'Upload session secret is not configured',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: UploadSessionPayload = {
    v: SESSION_VERSION,
    draftId: input.draftId,
    ...(input.orgId ? { orgId: input.orgId } : {}),
    iat: now,
    exp: now + (input.ttlSeconds || UPLOAD_SESSION_TTL_SECONDS),
    maxFiles: input.maxFiles || UPLOAD_MAX_TOTAL_FILES,
    maxFileSizeBytes: input.maxFileSizeBytes || UPLOAD_MAX_FILE_SIZE_BYTES,
    allowedFolders: input.allowedFolders || [...UPLOAD_ALLOWED_FOLDERS],
  };

  const payloadB64 = bytesToBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signatureB64 = signPayload(payloadB64, secret);
  return {
    token: `${payloadB64}.${signatureB64}`,
    payload,
  };
}

export function verifyUploadSessionToken(token?: string | null): UploadSessionVerificationResult {
  if (!token) {
    return { valid: false, code: 'MISSING_SESSION', error: 'Missing upload session token' };
  }

  const secret = getUploadSessionSecret();
  if (!secret) {
    return { valid: false, code: 'SERVER_CONFIG_ERROR', error: 'Upload session secret is not configured' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, code: 'INVALID_SESSION', error: 'Invalid upload session token format' };
  }

  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) {
    return { valid: false, code: 'INVALID_SESSION', error: 'Invalid upload session token' };
  }

  const expectedSignature = signPayload(payloadB64, secret);
  if (!secureEqual(signatureB64, expectedSignature)) {
    return { valid: false, code: 'INVALID_SESSION', error: 'Upload session token signature is invalid' };
  }

  let payload: UploadSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(base64UrlToBytes(payloadB64)).toString('utf8')) as UploadSessionPayload;
  } catch {
    return { valid: false, code: 'INVALID_SESSION', error: 'Upload session token payload is invalid' };
  }

  if (payload.v !== SESSION_VERSION || !payload.draftId) {
    return { valid: false, code: 'INVALID_SESSION', error: 'Upload session token payload is invalid' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { valid: false, code: 'SESSION_EXPIRED', error: 'Upload session has expired' };
  }

  return { valid: true, payload };
}

export function detectImageMimeTypeFromBytes(bytes: Uint8Array): AllowedImageMimeType | null {
  if (bytes.length < 12) {
    return null;
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // HEIC / HEIF: ISO BMFF with ftyp brand
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const majorBrand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(majorBrand)) {
      return 'image/heic';
    }
  }

  return null;
}

export async function validateImageBlob(
  file: Blob,
  maxFileSizeBytes = UPLOAD_MAX_FILE_SIZE_BYTES
): Promise<{ ok: boolean; code?: string; reason?: string; detectedMime?: AllowedImageMimeType }> {
  if (file.size <= 0) {
    return { ok: false, code: 'FILE_SIZE_INVALID', reason: 'File size is invalid (0 bytes).' };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      reason: `File is too large. Max ${Math.floor(maxFileSizeBytes / (1024 * 1024))}MB.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectImageMimeTypeFromBytes(bytes);

  if (!detectedMime) {
    return {
      ok: false,
      code: 'FILE_CONTENT_INVALID',
      reason: 'File content is not a supported image format (JPG/PNG/GIF/WebP/HEIC).',
    };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(detectedMime)) {
    return {
      ok: false,
      code: 'FILE_TYPE_INVALID',
      reason: `Unsupported image mime type: ${detectedMime}`,
    };
  }

  return { ok: true, detectedMime };
}

export function sanitizeUploadFolder(folder: unknown): string | null {
  if (typeof folder !== 'string' || !folder.trim()) {
    return null;
  }

  const normalized = folder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..')) {
    return null;
  }
  return normalized;
}

export function getExtensionFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) {
    return 'jpg';
  }
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg';
}

export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    default:
      return 'jpg';
  }
}
