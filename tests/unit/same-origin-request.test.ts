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

  it('allows configured platform-admin and marketing origins without trusting attackers', () => {
    const env = {
      NEXT_PUBLIC_APP_URL: 'https://app.smart-return.example.com',
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.smart-return.example.com',
      NEXT_PUBLIC_MARKETING_URL: 'https://www.smart-return.example.com',
    };

    for (const origin of [env.NEXT_PUBLIC_ADMIN_URL, env.NEXT_PUBLIC_MARKETING_URL]) {
      expect(checkSameOriginRequest({
        requestUrl: 'https://deployment.vercel.app/api/internal/saas/orgs',
        headers: new Headers({ origin }),
        env,
      }).allowed).toBe(true);
    }

    expect(checkSameOriginRequest({
      requestUrl: 'https://deployment.vercel.app/api/internal/saas/orgs',
      headers: new Headers({ origin: 'https://attacker.example.com' }),
      env,
    }).allowed).toBe(false);
  });

  it('still rejects explicit cross-site metadata for a configured admin origin', () => {
    const result = checkSameOriginRequest({
      requestUrl: 'https://admin.smart-return.example.com/api/internal/saas/orgs',
      headers: new Headers({
        origin: 'https://admin.smart-return.example.com',
        'sec-fetch-site': 'cross-site',
      }),
      env: {
        NEXT_PUBLIC_APP_URL: 'https://app.smart-return.example.com',
        NEXT_PUBLIC_ADMIN_URL: 'https://admin.smart-return.example.com',
      },
    });

    expect(result.allowed).toBe(false);
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
