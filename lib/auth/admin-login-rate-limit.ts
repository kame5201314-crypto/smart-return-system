export const ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_LOGIN_RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000;

interface AdminLoginAttemptEntry {
  failedAttempts: number;
  windowStartedAtMs: number;
  lockedUntilMs: number;
}

export interface AdminLoginRateLimitResult {
  allowed: boolean;
  failedAttempts: number;
  retryAfterSeconds: number;
}

const attempts = new Map<string, AdminLoginAttemptEntry>();

function nowMs(now: Date): number {
  return now.getTime();
}

function sanitizeKeyPart(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 128) : 'unknown';
}

function pruneExpiredEntries(now = new Date()): void {
  const current = nowMs(now);

  for (const [key, entry] of attempts.entries()) {
    const windowExpired = current - entry.windowStartedAtMs > ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS;
    const lockoutExpired = entry.lockedUntilMs > 0 && entry.lockedUntilMs <= current;

    if ((windowExpired && entry.lockedUntilMs === 0) || lockoutExpired) {
      attempts.delete(key);
    }
  }
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return sanitizeKeyPart(forwardedFor.split(',')[0]);
  }

  return sanitizeKeyPart(
    headers.get('cf-connecting-ip') ||
      headers.get('x-real-ip') ||
      headers.get('x-vercel-forwarded-for')
  );
}

export function buildAdminLoginRateLimitKey(input: {
  loginId: string;
  clientIp: string | null | undefined;
}): string {
  return `${sanitizeKeyPart(input.loginId)}:${sanitizeKeyPart(input.clientIp)}`;
}

export function checkAdminLoginRateLimit(
  key: string,
  now = new Date()
): AdminLoginRateLimitResult {
  pruneExpiredEntries(now);

  const entry = attempts.get(key);
  const current = nowMs(now);
  if (!entry || entry.lockedUntilMs <= current) {
    return {
      allowed: true,
      failedAttempts: entry?.failedAttempts ?? 0,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: false,
    failedAttempts: entry.failedAttempts,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntilMs - current) / 1000)),
  };
}

export function recordAdminLoginFailure(
  key: string,
  now = new Date()
): AdminLoginRateLimitResult {
  pruneExpiredEntries(now);

  const current = nowMs(now);
  const existing = attempts.get(key);
  const entry =
    existing && current - existing.windowStartedAtMs <= ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS
      ? existing
      : {
          failedAttempts: 0,
          windowStartedAtMs: current,
          lockedUntilMs: 0,
        };

  entry.failedAttempts += 1;
  if (entry.failedAttempts >= ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES) {
    entry.lockedUntilMs = current + ADMIN_LOGIN_RATE_LIMIT_LOCKOUT_MS;
  }

  attempts.set(key, entry);
  return checkAdminLoginRateLimit(key, now);
}

export function recordAdminLoginSuccess(key: string): void {
  attempts.delete(key);
}

export function resetAdminLoginRateLimitForTests(): void {
  attempts.clear();
}
