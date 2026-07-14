import { describe, expect, it, vi } from 'vitest';

import {
  buildSaaSLeadAttribution,
  captureSaaSLeadAttribution,
  SAAS_LEAD_ATTRIBUTION_STORAGE_KEY,
} from '@/lib/saas/lead-attribution';

function createStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial) values.set(SAAS_LEAD_ATTRIBUTION_STORAGE_KEY, initial);
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn(() => null),
    get length() {
      return values.size;
    },
  };
}

describe('SaaS lead attribution', () => {
  it('whitelists UTM values and excludes unrelated query parameters', () => {
    expect(
      buildSaaSLeadAttribution({
        url: 'https://smart-return.tw/signup?utm_source=facebook&utm_campaign=beta&token=secret',
        referrer: 'https://www.facebook.com/',
      })
    ).toEqual({
      utmSource: 'facebook',
      utmCampaign: 'beta',
      landingPath: '/signup',
      referrer: 'https://www.facebook.com/',
    });
  });

  it('keeps the first touch for the current browser session', () => {
    const storage = createStorage();
    const first = captureSaaSLeadAttribution({
      storage,
      url: 'https://smart-return.tw/?utm_source=google',
    });
    const second = captureSaaSLeadAttribution({
      storage,
      url: 'https://smart-return.tw/signup?utm_source=line',
    });

    expect(first).toEqual({ utmSource: 'google', landingPath: '/' });
    expect(second).toEqual(first);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
});
