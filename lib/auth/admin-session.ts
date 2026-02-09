const SESSION_VERSION = 1;
export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface AdminSessionPayload {
  sub: 'admin';
  iat: number;
  exp: number;
  v: number;
}

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createAdminSessionToken(): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: 'admin',
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
    v: SESSION_VERSION,
  };

  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  let signatureB64: string;
  try {
    const key = await importSigningKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    signatureB64 = bytesToBase64Url(new Uint8Array(signature));
  } catch {
    return null;
  }

  return `${payloadB64}.${signatureB64}`;
}

export async function verifyAdminSessionToken(token?: string | null): Promise<boolean> {
  if (!token) {
    return false;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) {
    return false;
  }

  let payload: AdminSessionPayload;
  let signatureBytes: Uint8Array;

  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as AdminSessionPayload;
    signatureBytes = base64UrlToBytes(signatureB64);
  } catch {
    return false;
  }

  if (payload.sub !== 'admin' || payload.v !== SESSION_VERSION) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > now + 60) {
    return false;
  }

  try {
    const key = await importSigningKey(secret);
    // Create a fresh view backed by ArrayBuffer to satisfy stricter TS BufferSource typing.
    const signatureForVerify = new Uint8Array(signatureBytes.byteLength);
    signatureForVerify.set(signatureBytes);
    return await crypto.subtle.verify('HMAC', key, signatureForVerify, new TextEncoder().encode(payloadB64));
  } catch {
    return false;
  }
}
