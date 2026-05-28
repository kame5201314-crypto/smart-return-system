import { describe, expect, it } from 'vitest';

import {
  checkSameOriginRequest,
  CROSS_SITE_REQUEST_ERROR_CODE,
} from '@/lib/security/same-origin';

describe('same-origin request guard', () => {
  it('allows matching origin requests', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://smart-return.example.com/api/saas/team/invites',
      headers: new Headers({
        origin: 'https://smart-return.example.com',
      }),
    });

    expect(result.allowed).toBe(true);
  });

  it('allows the configured app origin when request url is a deployment alias', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://smart-return-system-saas.vercel.app/api/saas/team/invites',
      headers: new Headers({
        origin: 'https://beta.smart-return.example.com',
      }),
      env: {
        NEXT_PUBLIC_APP_URL: 'https://beta.smart-return.example.com',
      },
    });

    expect(result.allowed).toBe(true);
  });

  it('rejects mismatched origin requests', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://smart-return.example.com/api/saas/team/invites',
      headers: new Headers({
        origin: 'https://attacker.example.com',
      }),
    });

    expect(result.allowed).toBe(false);
  });

  it('rejects explicit cross-site fetch metadata', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://smart-return.example.com/api/saas/team/invites',
      headers: new Headers({
        'sec-fetch-site': 'cross-site',
      }),
    });

    expect(result.allowed).toBe(false);
  });

  it('allows requests without browser origin headers for non-browser clients', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://smart-return.example.com/api/saas/team/invites',
      headers: new Headers(),
    });

    expect(result.allowed).toBe(true);
  });

  it('exports the shared error code for API responses', () => {
    expect(CROSS_SITE_REQUEST_ERROR_CODE).toBe('cross_site_request');
  });
});
