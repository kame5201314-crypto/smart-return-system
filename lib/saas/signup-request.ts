import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

export type SaaSPublicSignupRequestErrorCode =
  | 'feature_disabled'
  | 'invalid_request'
  | 'not_configured'
  | 'request_failed';

export interface SaaSPublicSignupRequestInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  plan: 'basic';
  monthlyReturnVolume?: number;
  message?: string;
}

export interface SaaSPublicSignupRequestResult {
  accepted: true;
  mode: 'public_signup';
  requestId: string | null;
}

export interface SaaSPublicSignupRequestRepository {
  createRequest(input: SaaSPublicSignupRequestInput): Promise<{ id?: string | null }>;
}

export type SaaSPublicSignupRequestRepositoryFactory =
  () => SaaSPublicSignupRequestRepository;

export interface SubmitSaaSPublicSignupRequestOptions {
  env?: Record<string, string | undefined>;
  repository?:
    | SaaSPublicSignupRequestRepository
    | SaaSPublicSignupRequestRepositoryFactory;
}

export class SaaSPublicSignupRequestError extends Error {
  constructor(
    public readonly code: SaaSPublicSignupRequestErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSPublicSignupRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  if (normalized.length > maxLength) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }

  return normalized;
}

function normalizeOptionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      `${field} must be a string.`
    );
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }

  return normalized;
}

function normalizeMonthlyReturnVolume(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      'monthlyReturnVolume must be a non-negative number.'
    );
  }

  return Math.floor(parsed);
}

function validateEmail(email: string): string {
  const normalized = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      'email must be a valid email address.'
    );
  }

  return normalized;
}

export function normalizeSaaSPublicSignupRequest(
  value: unknown
): SaaSPublicSignupRequestInput {
  if (!isRecord(value)) {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    companyName: normalizeRequiredString(value.companyName, 'companyName', 120),
    contactName: normalizeRequiredString(value.contactName, 'contactName', 120),
    email: validateEmail(normalizeRequiredString(value.email, 'email', 254)),
    phone: normalizeOptionalString(value.phone, 'phone', 40),
    plan: 'basic',
    monthlyReturnVolume: normalizeMonthlyReturnVolume(value.monthlyReturnVolume),
    message: normalizeOptionalString(value.message, 'message', 1000),
  };
}

function resolveSignupRequestRepository(
  repository:
    | SaaSPublicSignupRequestRepository
    | SaaSPublicSignupRequestRepositoryFactory
    | undefined
): SaaSPublicSignupRequestRepository | undefined {
  if (!repository) {
    return undefined;
  }

  return typeof repository === 'function' ? repository() : repository;
}

export async function submitSaaSPublicSignupRequest(
  value: unknown,
  options: SubmitSaaSPublicSignupRequestOptions = {}
): Promise<SaaSPublicSignupRequestResult> {
  const signupState = resolveSaaSPublicSignupState(options.env);

  if (!signupState.isPublicSignupEnabled) {
    throw new SaaSPublicSignupRequestError(
      'feature_disabled',
      403,
      'Public signup is not enabled.'
    );
  }

  const input = normalizeSaaSPublicSignupRequest(value);

  let repository: SaaSPublicSignupRequestRepository | undefined;
  try {
    repository = resolveSignupRequestRepository(options.repository);
  } catch {
    throw new SaaSPublicSignupRequestError(
      'not_configured',
      503,
      'Public signup persistence is not configured.'
    );
  }

  if (!repository) {
    throw new SaaSPublicSignupRequestError(
      'not_configured',
      503,
      'Public signup persistence is not configured.'
    );
  }

  try {
    const request = await repository.createRequest(input);

    return {
      accepted: true,
      mode: 'public_signup',
      requestId: request.id ?? null,
    };
  } catch (error) {
    if (error instanceof SaaSPublicSignupRequestError) {
      throw error;
    }

    throw new SaaSPublicSignupRequestError(
      'request_failed',
      500,
      'Public signup request failed.'
    );
  }
}
