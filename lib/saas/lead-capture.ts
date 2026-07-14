import type { SaaSPlanCode } from '@/lib/config/saas-plans';

export const SAAS_LEAD_CONTACT_CHANNELS = ['email', 'line', 'phone'] as const;
export type SaaSLeadContactChannel = (typeof SAAS_LEAD_CONTACT_CHANNELS)[number];

export const SAAS_MONTHLY_RETURN_BANDS = [
  'under_30',
  '30_100',
  '101_300',
  '301_800',
  'over_800',
] as const;
export type SaaSMonthlyReturnBand = (typeof SAAS_MONTHLY_RETURN_BANDS)[number];

export interface SaaSLeadAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
  referrer?: string;
}

export interface SaaSPublicLeadInput {
  companyName: string;
  contactName: string;
  email?: string;
  lineId?: string;
  phone?: string;
  preferredContactChannel: SaaSLeadContactChannel;
  requestedPlan: SaaSPlanCode;
  monthlyReturnBand: SaaSMonthlyReturnBand;
  platform?: string;
  painPoint?: string;
  attribution: SaaSLeadAttribution;
  privacyConsent: true;
}

export type SaaSPublicLeadErrorCode = 'invalid_request' | 'request_failed';

export class SaaSPublicLeadError extends Error {
  constructor(
    public readonly code: SaaSPublicLeadErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSPublicLeadError';
  }
}

function fail(message: string): never {
  throw new SaaSPublicLeadError('invalid_request', 400, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    fail(`${field} is too long.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    fail(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    fail(`${field} is too long.`);
  }
  return normalized;
}

function optionalEmail(value: unknown): string | undefined {
  const email = optionalString(value, 'email', 254)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('email must be a valid email address.');
  }
  return email;
}

function normalizeEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  fallback?: T
): T {
  if ((value === undefined || value === null || value === '') && fallback) {
    return fallback;
  }
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T;
  }
  fail(`${field} is invalid.`);
}

function normalizePlan(value: unknown): SaaSPlanCode {
  return normalizeEnum(value, 'requestedPlan', ['basic', 'growth', 'enterprise'] as const, 'basic');
}

function normalizeAttribution(value: unknown): SaaSLeadAttribution {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    fail('attribution must be an object.');
  }
  return {
    utmSource: optionalString(value.utmSource, 'attribution.utmSource', 120),
    utmMedium: optionalString(value.utmMedium, 'attribution.utmMedium', 120),
    utmCampaign: optionalString(value.utmCampaign, 'attribution.utmCampaign', 160),
    utmContent: optionalString(value.utmContent, 'attribution.utmContent', 160),
    utmTerm: optionalString(value.utmTerm, 'attribution.utmTerm', 160),
    landingPath: optionalString(value.landingPath, 'attribution.landingPath', 500),
    referrer: optionalString(value.referrer, 'attribution.referrer', 500),
  };
}

export function normalizeSaaSPublicLead(value: unknown): SaaSPublicLeadInput {
  if (!isRecord(value)) {
    fail('Request body must be an object.');
  }

  const email = optionalEmail(value.email);
  const lineId = optionalString(value.lineId, 'lineId', 80);
  const phone = optionalString(value.phone, 'phone', 40);
  if (!email && !lineId && !phone) {
    fail('At least one contact method is required.');
  }

  const preferredContactChannel = normalizeEnum(
    value.preferredContactChannel,
    'preferredContactChannel',
    SAAS_LEAD_CONTACT_CHANNELS,
    lineId ? 'line' : email ? 'email' : 'phone'
  );
  const selectedContact = { email, line: lineId, phone }[preferredContactChannel];
  if (!selectedContact) {
    fail(`preferredContactChannel requires ${preferredContactChannel}.`);
  }
  if (value.privacyConsent !== true) {
    fail('privacyConsent must be accepted.');
  }

  return {
    companyName: requiredString(value.companyName, 'companyName', 120),
    contactName: requiredString(value.contactName, 'contactName', 120),
    email,
    lineId,
    phone,
    preferredContactChannel,
    requestedPlan: normalizePlan(value.requestedPlan),
    monthlyReturnBand: normalizeEnum(
      value.monthlyReturnBand,
      'monthlyReturnBand',
      SAAS_MONTHLY_RETURN_BANDS
    ),
    platform: optionalString(value.platform, 'platform', 80),
    painPoint: optionalString(value.painPoint, 'painPoint', 1000),
    attribution: normalizeAttribution(value.attribution),
    privacyConsent: true,
  };
}
