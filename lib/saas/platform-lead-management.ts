import { ADMIN_UUID } from '@/lib/auth/admin-session';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import type {
  SaaSLeadContactChannel,
  SaaSMonthlyReturnBand,
} from '@/lib/saas/lead-capture';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';

export type PlatformLeadStatus = 'new' | 'contacted' | 'approved' | 'rejected' | 'converted';
export type PlatformLeadAction = 'mark_contacted' | 'approve' | 'reject' | 'convert';

export interface PlatformLeadRecord {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  lineId: string | null;
  phone: string | null;
  preferredContactChannel: SaaSLeadContactChannel;
  requestedPlan: SaaSPlanCode;
  monthlyReturnBand: SaaSMonthlyReturnBand | null;
  message: string | null;
  status: PlatformLeadStatus;
  orgId: string | null;
  metadata: Record<string, unknown>;
  contactedAt: string | null;
  followUpAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

export type PlatformLeadManagementErrorCode =
  | 'feature_disabled'
  | 'invalid_request'
  | 'not_found'
  | 'invalid_transition'
  | 'request_failed';

export class PlatformLeadManagementError extends Error {
  constructor(
    public readonly code: PlatformLeadManagementErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PlatformLeadManagementError';
  }
}

interface QueryError { message?: string }
interface QueryResult { data: unknown; error: QueryError | null }
interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  limit(value: number): QueryBuilder;
  update(values: Record<string, unknown>): QueryBuilder;
  insert(values: Record<string, unknown>): QueryBuilder;
  maybeSingle(): Promise<QueryResult>;
}

export interface PlatformLeadQueryClient {
  from(table: string): QueryBuilder;
}

export interface PlatformLeadRepository {
  listLeads(limit?: number): Promise<PlatformLeadRecord[]>;
  getLead(id: string): Promise<PlatformLeadRecord | null>;
  updateLead(input: {
    id: string;
    values: Record<string, unknown>;
  }): Promise<PlatformLeadRecord | null>;
  insertAuditLog(input: {
    orgId: string | null;
    actorUserId: string | null;
    action: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

const LEAD_COLUMNS = [
  'id', 'company_name', 'contact_name', 'email', 'line_id', 'phone',
  'preferred_contact_channel', 'plan', 'monthly_return_band', 'message',
  'status', 'org_id', 'metadata', 'contacted_at', 'follow_up_at',
  'processed_at', 'created_at',
].join(',');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeLead(row: unknown): PlatformLeadRecord | null {
  if (!isRecord(row)) return null;
  const id = stringOrNull(row.id);
  const companyName = stringOrNull(row.company_name);
  const contactName = stringOrNull(row.contact_name);
  const createdAt = stringOrNull(row.created_at);
  if (!id || !companyName || !contactName || !createdAt) return null;

  const rawStatus = stringOrNull(row.status);
  const contactedAt = stringOrNull(row.contacted_at);
  const status: PlatformLeadStatus =
    rawStatus === 'approved' || rawStatus === 'rejected' || rawStatus === 'converted'
      ? rawStatus
      : contactedAt
        ? 'contacted'
        : 'new';

  const plan = stringOrNull(row.plan);
  const contactChannel = stringOrNull(row.preferred_contact_channel);
  const returnBand = stringOrNull(row.monthly_return_band);

  return {
    id,
    companyName,
    contactName,
    email: stringOrNull(row.email),
    lineId: stringOrNull(row.line_id),
    phone: stringOrNull(row.phone),
    preferredContactChannel:
      contactChannel === 'line' || contactChannel === 'phone' ? contactChannel : 'email',
    requestedPlan:
      plan === 'growth' || plan === 'enterprise' ? plan : 'basic',
    monthlyReturnBand:
      returnBand === 'under_30' || returnBand === '30_100' || returnBand === '101_300' ||
      returnBand === '301_800' || returnBand === 'over_800'
        ? returnBand
        : null,
    message: stringOrNull(row.message),
    status,
    orgId: stringOrNull(row.org_id),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    contactedAt,
    followUpAt: stringOrNull(row.follow_up_at),
    processedAt: stringOrNull(row.processed_at),
    createdAt,
  };
}

function assertQuery(error: QueryError | null, fallback: string): void {
  if (error) {
    throw new PlatformLeadManagementError('request_failed', 500, error.message || fallback);
  }
}

export function createPlatformLeadRepository(
  client: PlatformLeadQueryClient
): PlatformLeadRepository {
  return {
    async listLeads(limit = 100) {
      const { data, error } = await client.from('signup_requests')
        .select(LEAD_COLUMNS)
        .eq('source', 'public_lead')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 200));
      assertQuery(error, 'Failed to list leads.');
      return Array.isArray(data)
        ? data.map(normalizeLead).filter((lead): lead is PlatformLeadRecord => Boolean(lead))
        : [];
    },
    async getLead(id) {
      const { data, error } = await client.from('signup_requests')
        .select(LEAD_COLUMNS)
        .eq('id', id)
        .eq('source', 'public_lead')
        .maybeSingle();
      assertQuery(error, 'Failed to load lead.');
      return normalizeLead(data);
    },
    async updateLead({ id, values }) {
      const { data, error } = await client.from('signup_requests')
        .update(values)
        .eq('id', id)
        .eq('source', 'public_lead')
        .select(LEAD_COLUMNS)
        .maybeSingle();
      assertQuery(error, 'Failed to update lead.');
      return normalizeLead(data);
    },
    async insertAuditLog(input) {
      const { error } = await client.from('audit_logs').insert({
        org_id: input.orgId,
        actor_user_id: input.actorUserId,
        action: input.action,
        target_type: 'signup_request',
        target_id: input.targetId,
        metadata: input.metadata,
      });
      assertQuery(error, 'Failed to write lead audit log.');
    },
  };
}

export function createDefaultPlatformLeadRepository(): PlatformLeadRepository {
  return createPlatformLeadRepository(
    createUntypedAdminClient() as unknown as PlatformLeadQueryClient
  );
}

export function assertPlatformLeadFeature(access: PlatformAdminContext): void {
  if (!access.featureFlags.public_lead_capture) {
    throw new PlatformLeadManagementError(
      'feature_disabled', 403, 'Public lead capture is not enabled.'
    );
  }
}

export function normalizePlatformLeadId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.trim())) {
    throw new PlatformLeadManagementError('invalid_request', 400, 'Lead id is invalid.');
  }
  return value.trim();
}

export function normalizePlatformLeadAction(value: unknown): PlatformLeadAction {
  if (value === 'mark_contacted' || value === 'approve' || value === 'reject' || value === 'convert') {
    return value;
  }
  throw new PlatformLeadManagementError('invalid_request', 400, 'Lead action is invalid.');
}

function assertTransition(status: PlatformLeadStatus, action: PlatformLeadAction): void {
  const allowed =
    (action === 'mark_contacted' && (status === 'new' || status === 'contacted')) ||
    ((action === 'approve' || action === 'reject') && (status === 'new' || status === 'contacted')) ||
    (action === 'convert' && status === 'approved');
  if (!allowed) {
    throw new PlatformLeadManagementError(
      'invalid_transition', 409, `Lead action ${action} is not allowed from ${status}.`
    );
  }
}

export async function updatePlatformLead(
  input: { leadId: unknown; action: unknown },
  access: PlatformAdminContext,
  repository: PlatformLeadRepository = createDefaultPlatformLeadRepository(),
  now = new Date()
): Promise<PlatformLeadRecord> {
  assertPlatformLeadFeature(access);
  const leadId = normalizePlatformLeadId(input.leadId);
  const action = normalizePlatformLeadAction(input.action);
  const current = await repository.getLead(leadId);
  if (!current) {
    throw new PlatformLeadManagementError('not_found', 404, 'Lead not found.');
  }
  assertTransition(current.status, action);

  const timestamp = now.toISOString();
  const values: Record<string, unknown> =
    action === 'mark_contacted'
      ? { contacted_at: current.contactedAt ?? timestamp }
      : {
          status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'converted',
          processed_at: timestamp,
          processed_by: access.userId === ADMIN_UUID ? null : access.userId,
        };
  const updated = await repository.updateLead({ id: leadId, values });
  if (!updated) {
    throw new PlatformLeadManagementError('not_found', 404, 'Lead not found.');
  }

  await repository.insertAuditLog({
    orgId: updated.orgId,
    actorUserId: access.userId === ADMIN_UUID ? null : access.userId,
    action: `platform.lead.${action}`,
    targetId: leadId,
    metadata: {
      company_name: updated.companyName,
      previous_status: current.status,
      status: updated.status,
    },
  });
  return updated;
}
