import {
  normalizeSaaSPlanCode,
  type SaaSPlanCode,
} from '@/lib/config/saas-plans';

export type PlatformOrgProvisioningErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'provision_failed';

export interface ManualBetaOrganizationInput {
  orgName: string;
  slug: string;
  ownerEmail: string;
  plan: SaaSPlanCode;
  ownerUserId?: string;
  billingEmail?: string;
  taxId?: string;
  trialEnd?: string;
  actorUserId: string;
}

export interface ManualBetaOrganizationResult {
  orgId: string;
  subscriptionId: string | null;
  ownerMembershipId: string | null;
  auditLogId: string | null;
}

export interface PlatformOrgProvisioningRepository {
  createManualBetaOrganization(
    input: ManualBetaOrganizationInput
  ): Promise<ManualBetaOrganizationResult>;
}

interface SupabaseRpcError {
  message?: string;
}

interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
}

export class PlatformOrgProvisioningError extends Error {
  constructor(
    public readonly code: PlatformOrgProvisioningErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PlatformOrgProvisioningError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  const normalized = stringOrUndefined(value);
  if (!normalized) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }
  if (normalized.length > maxLength) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  const normalized = stringOrUndefined(value);
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }
  return normalized;
}

function normalizeEmail(value: unknown, field: string): string {
  const normalized = requireString(value, field, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      `${field} must be a valid email address.`
    );
  }
  return normalized;
}

function normalizeOptionalEmail(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, field, 254);
  return normalized ? normalizeEmail(normalized, field) : undefined;
}

function normalizeSlug(value: unknown): string {
  const normalized = requireString(value, 'slug', 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/.test(normalized)) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'slug must be 3-64 characters and use lowercase letters, numbers, and hyphens.'
    );
  }
  return normalized;
}

function normalizePlan(value: unknown): SaaSPlanCode {
  if (value === undefined || value === null || value === '') {
    return 'basic';
  }

  if (typeof value !== 'string') {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'plan must be a string.'
    );
  }

  const normalized = value.trim().toLowerCase();
  const plan = normalizeSaaSPlanCode(normalized);
  if (plan !== normalized) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'plan must be one of basic, growth, enterprise.'
    );
  }
  return plan;
}

function normalizeUuid(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, field, 64);
  if (!normalized) {
    return undefined;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      `${field} must be a valid UUID.`
    );
  }
  return normalized;
}

function normalizeTaxId(value: unknown): string | undefined {
  const normalized = optionalString(value, 'taxId', 8);
  if (!normalized) {
    return undefined;
  }
  if (!/^\d{8}$/.test(normalized)) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'taxId must be an 8-digit Taiwan business tax id.'
    );
  }
  return normalized;
}

function normalizeTrialEnd(value: unknown): string | undefined {
  const normalized = optionalString(value, 'trialEnd', 40);
  if (!normalized) {
    return undefined;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    const daysInMonth = month >= 1 && month <= 12
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 0;

    if (year < 2000 || year > 9999 || day < 1 || day > daysInMonth) {
      throw new PlatformOrgProvisioningError(
        'invalid_request',
        400,
        'trialEnd must be an ISO date string.'
      );
    }

    // Asia/Taipei is UTC+08:00 year-round. Store the selected local date's
    // final millisecond so the trial remains active through that Taiwan day.
    return new Date(Date.UTC(year, month - 1, day, 15, 59, 59, 999)).toISOString();
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'trialEnd must be an ISO date string.'
    );
  }

  return parsed.toISOString();
}

function nullableString(value: string | undefined): string | null {
  return value ?? null;
}

function normalizeRpcResult(data: unknown): ManualBetaOrganizationResult {
  if (!isRecord(data)) {
    throw new Error('Manual beta organization RPC returned invalid data.');
  }

  const orgId = stringOrUndefined(data.org_id);
  if (!orgId) {
    throw new Error('Manual beta organization RPC did not return org_id.');
  }

  return {
    orgId,
    subscriptionId: stringOrUndefined(data.subscription_id) ?? null,
    ownerMembershipId: stringOrUndefined(data.owner_membership_id) ?? null,
    auditLogId: stringOrUndefined(data.audit_log_id) ?? null,
  };
}

export function normalizeManualBetaOrganizationInput(
  value: unknown,
  actorUserId: string
): ManualBetaOrganizationInput {
  if (!isRecord(value)) {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    orgName: requireString(value.orgName, 'orgName', 120),
    slug: normalizeSlug(value.slug),
    ownerEmail: normalizeEmail(value.ownerEmail, 'ownerEmail'),
    plan: normalizePlan(value.plan),
    ownerUserId: normalizeUuid(value.ownerUserId, 'ownerUserId'),
    billingEmail: normalizeOptionalEmail(value.billingEmail, 'billingEmail'),
    taxId: normalizeTaxId(value.taxId),
    trialEnd: normalizeTrialEnd(value.trialEnd),
    actorUserId: requireString(actorUserId, 'actorUserId', 64),
  };
}

export function buildManualBetaOrganizationRpcArgs(
  input: ManualBetaOrganizationInput
): Record<string, unknown> {
  return {
    p_org_name: input.orgName,
    p_slug: input.slug,
    p_plan: input.plan,
    p_owner_email: input.ownerEmail,
    p_owner_user_id: nullableString(input.ownerUserId),
    p_billing_email: nullableString(input.billingEmail),
    p_tax_id: nullableString(input.taxId),
    p_trial_end: nullableString(input.trialEnd),
    p_actor_user_id: input.actorUserId,
  };
}

export function createPlatformOrgProvisioningRepository(
  client: SupabaseRpcClient
): PlatformOrgProvisioningRepository {
  return {
    async createManualBetaOrganization(input) {
      const { data, error } = await client.rpc(
        'create_manual_beta_organization',
        buildManualBetaOrganizationRpcArgs(input)
      );

      if (error) {
        throw new PlatformOrgProvisioningError(
          'provision_failed',
          500,
          error.message || 'Failed to provision manual beta organization.'
        );
      }

      return normalizeRpcResult(data);
    },
  };
}
