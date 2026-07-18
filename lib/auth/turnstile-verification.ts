export const PASSWORD_LOGIN_TURNSTILE_ACTION = 'password_login';
export const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const TURNSTILE_TOKEN_MAX_LENGTH = 2048;
const DEFAULT_TIMEOUT_MS = 5000;
const CLOUDFLARE_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export type TurnstileVerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'configuration_error'
        | 'provider_error'
        | 'challenge_rejected'
        | 'action_mismatch'
        | 'hostname_mismatch';
    };

interface TurnstileSiteverifyResponse {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
}

interface TurnstileVerificationOptions {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || [
    'replace_with',
    'replace-with',
    'your_',
    'your-',
    'placeholder',
    'change_me',
    'change-me',
  ].some((marker) => normalized.includes(marker));
}

function resolveExpectedHostnames(
  env: Record<string, string | undefined>
): Set<string> | null {
  const configuredUrls = [env.NEXT_PUBLIC_APP_URL];
  if ((env.NEXT_PUBLIC_ADMIN_URL || '').trim()) {
    configuredUrls.push(env.NEXT_PUBLIC_ADMIN_URL);
  }

  const hostnames = new Set<string>();
  for (const configuredUrl of configuredUrls) {
    try {
      const url = new URL((configuredUrl || '').trim());
      if (!url.hostname || url.username || url.password) return null;
      if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) return null;
      const production = (env.NODE_ENV || '').trim().toLowerCase() === 'production';
      if (production && url.protocol !== 'https:') return null;
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      hostnames.add(url.hostname.toLowerCase());
    } catch {
      return null;
    }
  }

  return hostnames.size > 0 ? hostnames : null;
}

export function canBypassPasswordLoginTurnstileForLocalDevelopment(
  env: Record<string, string | undefined> = process.env
): boolean {
  if ((env.NODE_ENV || '').trim().toLowerCase() !== 'development') {
    return false;
  }

  try {
    const appUrl = new URL((env.NEXT_PUBLIC_APP_URL || '').trim());
    return appUrl.protocol === 'http:'
      && !appUrl.username
      && !appUrl.password
      && LOOPBACK_HOSTNAMES.has(appUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeRemoteIp(value: string | null | undefined): string | null {
  const normalized = (value || '').trim();
  if (!normalized || normalized.length > 64) return null;
  return /^[0-9a-f:.]+$/i.test(normalized) ? normalized : null;
}

export async function verifyPasswordLoginTurnstile(
  input: { token?: string | null; remoteIp?: string | null },
  options: TurnstileVerificationOptions = {}
): Promise<TurnstileVerificationResult> {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (!token || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return { ok: false, reason: 'invalid_input' };
  }

  const env = options.env || process.env;
  const secret = (env.TURNSTILE_SECRET_KEY || '').trim();
  const expectedHostnames = resolveExpectedHostnames(env);
  if (isPlaceholder(secret) || !expectedHostnames) {
    return { ok: false, reason: 'configuration_error' };
  }
  if (
    (env.NODE_ENV || '').trim().toLowerCase() === 'production' &&
    CLOUDFLARE_TEST_SECRET_KEYS.has(secret)
  ) {
    return { ok: false, reason: 'configuration_error' };
  }

  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = normalizeRemoteIp(input.remoteIp);
  if (remoteIp) body.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(250, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  );

  try {
    const response = await (options.fetcher || fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, reason: 'provider_error' };

    let data: TurnstileSiteverifyResponse;
    try {
      data = await response.json() as TurnstileSiteverifyResponse;
    } catch {
      return { ok: false, reason: 'provider_error' };
    }

    if (data.success !== true) return { ok: false, reason: 'challenge_rejected' };
    if (data.action !== PASSWORD_LOGIN_TURNSTILE_ACTION) {
      return { ok: false, reason: 'action_mismatch' };
    }
    if (
      typeof data.hostname !== 'string' ||
      !expectedHostnames.has(data.hostname.trim().toLowerCase())
    ) {
      return { ok: false, reason: 'hostname_mismatch' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'provider_error' };
  } finally {
    clearTimeout(timeout);
  }
}
