import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type {
  SaaSEmailQueueStatus,
  SaaSNotificationEventType,
} from '@/lib/saas/notifications';

export type SaaSEmailQueueBlockedReason =
  | 'not_queued'
  | 'not_due'
  | 'max_attempts_exceeded'
  | 'delivery_provider_not_configured'
  | 'delivery_disabled';

export interface SaaSEmailQueueWorkerRecord {
  id: string;
  orgId: string;
  recipientEmail: string;
  templateKey: string;
  subject: string;
  eventType: SaaSNotificationEventType;
  payload: Record<string, unknown>;
  status: SaaSEmailQueueStatus;
  sendAfter: string | null;
  attemptCount: number;
  createdAt: string;
}

export interface SaaSEmailQueueWorkerDecision {
  emailQueueId: string;
  orgId: string;
  recipientEmail: string;
  templateKey: string;
  eventType: SaaSNotificationEventType;
  status: SaaSEmailQueueStatus;
  attemptCount: number;
  canSend: boolean;
  dryRunOnly: boolean;
  blockedReason: SaaSEmailQueueBlockedReason | null;
}

export interface SaaSEmailQueueWorkerPreview {
  checkedAt: string;
  deliveryProviderEnabled: boolean;
  dryRunOnly: boolean;
  summary: {
    scanned: number;
    sendable: number;
    blocked: number;
    maxAttempts: number;
  };
  decisions: SaaSEmailQueueWorkerDecision[];
}

export interface SaaSEmailQueueWorkerOptions {
  now?: Date;
  maxAttempts?: number;
  deliveryProviderEnabled?: boolean;
}

export interface SaaSEmailQueueWorkerRepository {
  listDueEmailQueue(input: {
    now: string;
    limit: number;
  }): Promise<SaaSEmailQueueWorkerRecord[]>;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseEmailQueueQueryBuilder extends PromiseLike<{
  data: unknown;
  error: SupabaseQueryError | null;
}> {
  select(columns: string): SupabaseEmailQueueQueryBuilder;
  eq(column: string, value: string): SupabaseEmailQueueQueryBuilder;
  or(filter: string): SupabaseEmailQueueQueryBuilder;
  order(column: string, options: { ascending: boolean }): SupabaseEmailQueueQueryBuilder;
  limit(count: number): SupabaseEmailQueueQueryBuilder;
}

export interface SaaSEmailQueueWorkerQueryClient {
  from(table: string): SupabaseEmailQueueQueryBuilder;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_DUE_LIMIT = 50;
const VALID_EMAIL_QUEUE_STATUSES: readonly SaaSEmailQueueStatus[] = [
  'queued',
  'sent',
  'failed',
  'cancelled',
];
const VALID_EVENT_TYPES: readonly SaaSNotificationEventType[] = [
  'billing_payment_failed',
  'ai_quota_reached',
  'trial_ending',
  'platform_announcement',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeStatus(value: unknown): SaaSEmailQueueStatus {
  const status = stringOrNull(value) ?? 'queued';
  if (VALID_EMAIL_QUEUE_STATUSES.includes(status as SaaSEmailQueueStatus)) {
    return status as SaaSEmailQueueStatus;
  }
  throw new Error(`Invalid email queue status: ${status}`);
}

function normalizeEventType(value: unknown): SaaSNotificationEventType {
  const eventType = stringOrNull(value);
  if (eventType && VALID_EVENT_TYPES.includes(eventType as SaaSNotificationEventType)) {
    return eventType as SaaSNotificationEventType;
  }
  throw new Error(`Invalid email queue event type: ${String(value)}`);
}

function normalizePayload(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeAttemptCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeEmailQueueRow(row: unknown): SaaSEmailQueueWorkerRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  const recipientEmail = stringOrNull(row.recipient_email);
  const templateKey = stringOrNull(row.template_key);
  const subject = stringOrNull(row.subject);
  const createdAt = stringOrNull(row.created_at);
  if (!id || !orgId || !recipientEmail || !templateKey || !subject || !createdAt) {
    return null;
  }

  return {
    id,
    orgId,
    recipientEmail,
    templateKey,
    subject,
    eventType: normalizeEventType(row.event_type),
    payload: normalizePayload(row.payload),
    status: normalizeStatus(row.status),
    sendAfter: stringOrNull(row.send_after),
    attemptCount: normalizeAttemptCount(row.attempt_count),
    createdAt,
  };
}

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_DUE_LIMIT;
  }
  return Math.min(value, 500);
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_MAX_ATTEMPTS;
  }
  return Math.min(value, 25);
}

function isDue(record: SaaSEmailQueueWorkerRecord, now: Date): boolean {
  if (!record.sendAfter) {
    return true;
  }
  const sendAfter = new Date(record.sendAfter);
  return !Number.isNaN(sendAfter.getTime()) && sendAfter.getTime() <= now.getTime();
}

function buildDecision(
  record: SaaSEmailQueueWorkerRecord,
  options: Required<Pick<SaaSEmailQueueWorkerOptions, 'maxAttempts' | 'deliveryProviderEnabled'>> & {
    now: Date;
  }
): SaaSEmailQueueWorkerDecision {
  let blockedReason: SaaSEmailQueueBlockedReason | null = null;

  if (record.status !== 'queued') {
    blockedReason = 'not_queued';
  } else if (!isDue(record, options.now)) {
    blockedReason = 'not_due';
  } else if (record.attemptCount >= options.maxAttempts) {
    blockedReason = 'max_attempts_exceeded';
  } else if (!options.deliveryProviderEnabled) {
    blockedReason = 'delivery_provider_not_configured';
  }

  return {
    emailQueueId: record.id,
    orgId: record.orgId,
    recipientEmail: record.recipientEmail,
    templateKey: record.templateKey,
    eventType: record.eventType,
    status: record.status,
    attemptCount: record.attemptCount,
    canSend: blockedReason === null,
    dryRunOnly: true,
    blockedReason,
  };
}

export function buildSaaSEmailQueueWorkerPreview(
  records: SaaSEmailQueueWorkerRecord[],
  options: SaaSEmailQueueWorkerOptions = {}
): SaaSEmailQueueWorkerPreview {
  const now = options.now ?? new Date();
  const maxAttempts = normalizeMaxAttempts(options.maxAttempts);
  const deliveryProviderEnabled = options.deliveryProviderEnabled === true;
  const decisions = records.map((record) =>
    buildDecision(record, {
      now,
      maxAttempts,
      deliveryProviderEnabled,
    })
  );

  return {
    checkedAt: now.toISOString(),
    deliveryProviderEnabled,
    dryRunOnly: true,
    summary: {
      scanned: records.length,
      sendable: decisions.filter((decision) => decision.canSend).length,
      blocked: decisions.filter((decision) => !decision.canSend).length,
      maxAttempts,
    },
    decisions,
  };
}

export function createSaaSEmailQueueWorkerRepository(
  client: SaaSEmailQueueWorkerQueryClient
): SaaSEmailQueueWorkerRepository {
  return {
    async listDueEmailQueue(input) {
      const limit = normalizeLimit(input.limit);
      const { data, error } = await client
        .from('email_queue')
        .select(
          'id, org_id, recipient_email, template_key, subject, event_type, payload, status, send_after, attempt_count, created_at'
        )
        .eq('status', 'queued')
        .or(`send_after.is.null,send_after.lte.${input.now}`)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(error.message || 'Failed to load due email queue.');
      }

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .map(normalizeEmailQueueRow)
        .filter((record): record is SaaSEmailQueueWorkerRecord => record !== null);
    },
  };
}

export function createDefaultSaaSEmailQueueWorkerRepository() {
  return createSaaSEmailQueueWorkerRepository(
    createUntypedAdminClient() as unknown as SaaSEmailQueueWorkerQueryClient
  );
}
