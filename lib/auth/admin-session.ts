const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface AdminSessionPayload {
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
  nonce: string;
}

const ADMIN_SESSION_SECRET_MIN_LENGTH = 32;

function getSessionSecret(): string {
  // Fail closed: require a dedicated ADMIN_SESSION_SECRET. The service-role key
  // must never double as the session-signing secret — a leak of one would
  // otherwise compromise both database access and admin sessions.
  const secret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (!secret) {
    throw new Error('Missing ADMIN_SESSION_SECRET');
  }
  if (secret.length < ADMIN_SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `ADMIN_SESSION_SECRET must be at least ${ADMIN_SESSION_SECRET_MIN_LENGTH} characters`
    );
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url: string): Uint8Array {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function encodePayload(payload: AdminSessionPayload): string {
  const payloadBytes = textEncoder.encode(JSON.stringify(payload));
  return toBase64Url(payloadBytes);
}

function decodePayload(value: string): AdminSessionPayload | null {
  try {
    const decoded = textDecoder.decode(fromBase64Url(value));
    return JSON.parse(decoded) as AdminSessionPayload;
  } catch {
    return null;
  }
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signPayload(encodedPayload: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(encodedPayload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createAdminSessionToken(subject = 'admin'): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: subject,
    role: 'admin',
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = encodePayload(payload);
  const signature = await signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encodedPayload, signature] = parts;
    if (!encodedPayload || !signature) return null;

    const expectedSignature = await signPayload(encodedPayload);
    if (!safeEqual(signature, expectedSignature)) return null;

    const payload = decodePayload(encodedPayload);
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.role !== 'admin') return null;
    if (payload.exp <= now) return null;
    if (!payload.sub || !payload.nonce) return null;

    return payload;
  } catch {
    // A missing/invalid signing secret (or any unexpected error) must reject the
    // session rather than surface as a 500 — fail closed.
    return null;
  }
}

export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  path: '/',
};
