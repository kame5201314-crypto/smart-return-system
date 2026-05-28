export interface InMemoryRateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface InMemoryRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetAtMs: number;
}

function nowMs(now: Date): number {
  return now.getTime();
}

function sanitizeKeyPart(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 160) : 'unknown';
}

export function getClientIpForRateLimit(headers: Headers): string {
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

export function buildClientRateLimitKey(input: {
  scope: string;
  headers: Headers;
}): string {
  return [
    sanitizeKeyPart(input.scope),
    getClientIpForRateLimit(input.headers),
    sanitizeKeyPart(input.headers.get('user-agent')),
  ].join(':');
}

export function createInMemoryRateLimiter(options: InMemoryRateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();

  function prune(currentMs: number): void {
    for (const [key, entry] of entries.entries()) {
      if (entry.resetAtMs <= currentMs) {
        entries.delete(key);
      }
    }
  }

  return {
    check(key: string, now = new Date()): InMemoryRateLimitResult {
      const currentMs = nowMs(now);
      prune(currentMs);

      const existing = entries.get(key);
      if (!existing) {
        entries.set(key, {
          count: 1,
          resetAtMs: currentMs + options.windowMs,
        });

        return {
          allowed: true,
          remaining: Math.max(0, options.maxRequests - 1),
          retryAfterSeconds: 0,
        };
      }

      if (existing.count >= options.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAtMs - currentMs) / 1000)
          ),
        };
      }

      existing.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, options.maxRequests - existing.count),
        retryAfterSeconds: 0,
      };
    },

    resetForTests(): void {
      entries.clear();
    },
  };
}
