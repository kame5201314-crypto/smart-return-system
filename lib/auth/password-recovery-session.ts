const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const PASSWORD_RECOVERY_SESSION_COOKIE = 'password_recovery_session';
export const PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS = 60 * 10;

interface PasswordRecoverySessionPayload {
  sub: string;
  purpose: 'password_recovery';
  iat: number;
  exp: number;
  nonce: string;
}

function getSessionSecret(): string {
  const secret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (!secret) throw new Error('Missing password recovery session secret');
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function signPayload(encodedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(`smart-return:${encodedPayload}`)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function createPasswordRecoverySessionToken(userId: string): Promise<string> {
  if (!userId) throw new Error('Missing password recovery user');
  const now = Math.floor(Date.now() / 1000);
  const payload: PasswordRecoverySessionPayload = {
    sub: userId,
    purpose: 'password_recovery',
    iat: now,
    exp: now + PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  return `${encodedPayload}.${await signPayload(encodedPayload)}`;
}

export async function verifyPasswordRecoverySessionToken(
  token: string | null | undefined
): Promise<PasswordRecoverySessionPayload | null> {
  if (!token) return null;
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra) return null;
  if (!safeEqual(signature, await signPayload(encodedPayload))) return null;

  try {
    const payload = JSON.parse(
      textDecoder.decode(fromBase64Url(encodedPayload))
    ) as PasswordRecoverySessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== 'password_recovery' || !payload.sub || !payload.nonce) return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (payload.iat > now + 60 || payload.exp <= now) return null;
    if (payload.exp <= payload.iat || payload.exp - payload.iat > PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const PASSWORD_RECOVERY_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: PASSWORD_RECOVERY_SESSION_MAX_AGE_SECONDS,
  path: '/',
};
