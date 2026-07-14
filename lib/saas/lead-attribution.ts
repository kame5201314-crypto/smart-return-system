import type { SaaSLeadAttribution } from '@/lib/saas/lead-capture';

export const SAAS_LEAD_ATTRIBUTION_STORAGE_KEY = 'smart-return:first-touch-attribution';

const UTM_KEYS = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
} as const;

function clean(value: string | null, maxLength: number): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function buildSaaSLeadAttribution(params: {
  url: string;
  referrer?: string;
}): SaaSLeadAttribution {
  const url = new URL(params.url);
  const attribution: SaaSLeadAttribution = {
    landingPath: clean(url.pathname, 500),
    referrer: clean(params.referrer ?? '', 500),
  };

  for (const [queryKey, outputKey] of Object.entries(UTM_KEYS)) {
    const value = clean(url.searchParams.get(queryKey), 160);
    if (value) attribution[outputKey] = value;
  }

  return attribution;
}

function readStoredAttribution(storage: Storage): SaaSLeadAttribution | null {
  try {
    const raw = storage.getItem(SAAS_LEAD_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    return typeof value === 'object' && value !== null
      ? (value as SaaSLeadAttribution)
      : null;
  } catch {
    return null;
  }
}

export function captureSaaSLeadAttribution(params: {
  storage: Storage;
  url: string;
  referrer?: string;
}): SaaSLeadAttribution {
  const stored = readStoredAttribution(params.storage);
  if (stored) return stored;

  const attribution = buildSaaSLeadAttribution(params);
  try {
    params.storage.setItem(
      SAAS_LEAD_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify(attribution)
    );
  } catch {
    // Attribution must never block the lead form.
  }
  return attribution;
}
