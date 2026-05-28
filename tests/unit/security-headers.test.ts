import { describe, expect, it } from 'vitest';

import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from '@/lib/security/headers';

describe('security headers', () => {
  it('sets browser hardening headers for every route', () => {
    const headers = new Map(SECURITY_HEADERS.map((header) => [header.key, header.value]));

    expect(headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Permissions-Policy')).toContain('microphone=()');
    expect(headers.get('Permissions-Policy')).toContain('geolocation=()');
  });

  it('blocks framing and restricts risky CSP defaults', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });
});
