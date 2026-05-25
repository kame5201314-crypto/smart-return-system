import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type SaaSNotificationEventType =
  | 'billing_payment_failed'
  | 'ai_quota_reached'
  | 'trial_ending'
  | 'platform_announcement';

export type SaaSNotificationChannel = 'in_app' | 'email';

export type SaaSNotificationRecipientRole =
  | 'owner'
  | 'admin'
  | 'billing'
  | 'support'
  | 'staff'
  | 'viewer';

export type SaaSEmailQueueStatus = 'queued' | 'sent' | 'failed' | 'cancelled';

export interface SaaSNotificationRecipient {
  userId?: string | null;
  email?: string | null;
  role?: SaaSNotificationRecipientRole | null;
  name?: string | null;
  channels?: SaaSNotificationChannel[];
}

export interface BuildSaaSNotificationDispatchInput {
  eventType: SaaSNotificationEventType;
  orgId: string;
  recipients: SaaSNotificationRecipient[];
  title?: string | null;
  message?: string | null;
  actionUrl?: string | null;
  payload?: Record<string, unknown>;
  sendAfter?: string | null;
  idempotencyKey?: string | null;
}

export interface BillingPaymentFailedNotificationInput {
  orgId: string;
  recipients: SaaSNotificationRecipient[];
  invoiceId?: string | null;
  provider?: string | null;
  amountTwd?: number | null;
  failedAt?: string | null;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface AIQuotaReachedNotificationInput {
  orgId: string;
  recipients: SaaSNotificationRecipient[];
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface TrialEndingNotificationInput {
  orgId: string;
  recipients: SaaSNotificationRecipient[];
  trialEnd: string;
  daysUntilTrialEnd: number;
  actionUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface PlatformAnnouncementNotificationInput {
  orgId: string;
  recipients: SaaSNotificationRecipient[];
  title: string;
  message: string;
  announcementId?: string | null;
  actionUrl?: string | null;
  sendAfter?: string | null;
  idempotencyKey?: string | null;
}

export interface SaaSNotificationInsert {
  org_id: string;
  user_id: string;
  notification_type: SaaSNotificationEventType;
  title: string;
  message: string;
  action_url: string | null;
  metadata: Record<string, unknown>;
  idempotency_key: string | null;
}

export interface SaaSEmailQueueInsert {
  org_id: string;
  recipient_user_id: string | null;
  recipient_email: string;
  template_key: SaaSNotificationTemplateKey;
  subject: string;
  event_type: SaaSNotificationEventType;
  payload: Record<string, unknown>;
  status: SaaSEmailQueueStatus;
  send_after: string | null;
  idempotency_key: string | null;
}

export interface SaaSNotificationDispatch {
  eventType: SaaSNotificationEventType;
  notifications: SaaSNotificationInsert[];
  emailQueue: SaaSEmailQueueInsert[];
}

export interface SaaSNotificationQueueResult {
  notificationCount: number;
  emailQueueCount: number;
}

export interface SaaSNotificationQueueRepository {
  enqueue(dispatch: SaaSNotificationDispatch): Promise<SaaSNotificationQueueResult>;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseInsertQuery {
  select(columns: string): PromiseLike<{ error: SupabaseQueryError | null }>;
}

export interface SaaSNotificationQueueClient {
  from(table: string): {
    insert(values: Record<string, unknown>[]): SupabaseInsertQuery;
  };
}

type SaaSNotificationTemplateKey =
  | 'billing.payment_failed'
  | 'usage.ai_quota_reached'
  | 'trial.ending'
  | 'platform.announcement';

interface SaaSNotificationTemplate {
  title: string;
  message: string;
  subject: string;
  templateKey: SaaSNotificationTemplateKey;
}

const VALID_EVENT_TYPES: readonly SaaSNotificationEventType[] = [
  'billing_payment_failed',
  'ai_quota_reached',
  'trial_ending',
  'platform_announcement',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOTIFICATION_TEMPLATES: Record<SaaSNotificationEventType, SaaSNotificationTemplate> = {
  billing_payment_failed: {
    title: 'Payment failed',
    message: 'A subscription payment failed. Please update billing or review the account.',
    subject: 'Payment failed for your Smart Return account',
    templateKey: 'billing.payment_failed',
  },
  ai_quota_reached: {
    title: 'AI quota reached',
    message: 'The monthly AI usage limit has been reached for this workspace.',
    subject: 'Your Smart Return AI quota has been reached',
    templateKey: 'usage.ai_quota_reached',
  },
  trial_ending: {
    title: 'Trial ending soon',
    message: 'The workspace trial is ending soon. Please choose a plan to keep service active.',
    subject: 'Your Smart Return trial is ending soon',
    templateKey: 'trial.ending',
  },
  platform_announcement: {
    title: 'Platform announcement',
    message: 'There is a new platform announcement for your workspace.',
    subject: 'Smart Return platform announcement',
    templateKey: 'platform.announcement',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} is required.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }

  return normalized;
}

function normalizeOptionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }

  return normalized;
}

function normalizeUuid(value: unknown, field: string): string {
  const normalized = normalizeRequiredString(value, field, 64);
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a valid UUID.`);
  }
  return normalized;
}

function normalizeOptionalUuid(value: unknown, field: string): string | null {
  const normalized = normalizeOptionalString(value, field, 64);
  if (!normalized) {
    return null;
  }
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${field} must be a valid UUID.`);
  }
  return normalized;
}

function normalizeEmail(value: unknown, field: string): string | null {
  const normalized = normalizeOptionalString(value, field, 254);
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (!EMAIL_PATTERN.test(lowered)) {
    throw new Error(`${field} must be a valid email address.`);
  }

  return lowered;
}

function normalizeIsoDate(value: unknown, field: string): string | null {
  const normalized = normalizeOptionalString(value, field, 80);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be an ISO date string.`);
  }

  return parsed.toISOString();
}

function normalizePayload(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error('payload must be an object.');
  }
  return value;
}

function normalizeEventType(value: unknown): SaaSNotificationEventType {
  const normalized = normalizeRequiredString(value, 'eventType', 80);
  if (!VALID_EVENT_TYPES.includes(normalized as SaaSNotificationEventType)) {
    throw new Error('eventType is not supported.');
  }
  return normalized as SaaSNotificationEventType;
}

function normalizeChannels(channels: SaaSNotificationRecipient['channels']): SaaSNotificationChannel[] {
  if (!channels || channels.length === 0) {
    return ['in_app', 'email'];
  }

  const unique = new Set<SaaSNotificationChannel>();
  for (const channel of channels) {
    if (channel !== 'in_app' && channel !== 'email') {
      throw new Error('recipient channel is not supported.');
    }
    unique.add(channel);
  }

  return [...unique];
}

function normalizeRecipient(recipient: SaaSNotificationRecipient): Required<SaaSNotificationRecipient> {
  const userId = normalizeOptionalUuid(recipient.userId, 'recipient.userId');
  const email = normalizeEmail(recipient.email, 'recipient.email');

  if (!userId && !email) {
    throw new Error('recipient.userId or recipient.email is required.');
  }

  return {
    userId,
    email,
    role: recipient.role ?? null,
    name: recipient.name ?? null,
    channels: normalizeChannels(recipient.channels),
  };
}

function recipientKey(recipient: Required<SaaSNotificationRecipient>): string {
  return `${recipient.userId ?? ''}:${recipient.email ?? ''}:${recipient.channels.join(',')}`;
}

function buildRecipientMetadata(
  recipient: Required<SaaSNotificationRecipient>,
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...payload,
    recipient: {
      role: recipient.role,
      email: recipient.email,
      name: recipient.name,
    },
  };
}

function buildIdempotencyKey(
  baseKey: string | null,
  eventType: SaaSNotificationEventType,
  channel: SaaSNotificationChannel,
  recipient: Required<SaaSNotificationRecipient>
): string | null {
  if (!baseKey) {
    return null;
  }

  return [
    baseKey,
    eventType,
    channel,
    recipient.userId ?? 'no-user',
    recipient.email ?? 'no-email',
  ].join(':');
}

export function getSaaSNotificationTemplate(
  eventType: SaaSNotificationEventType
): SaaSNotificationTemplate {
  return NOTIFICATION_TEMPLATES[eventType];
}

export function buildSaaSNotificationDispatch(
  input: BuildSaaSNotificationDispatchInput
): SaaSNotificationDispatch {
  const eventType = normalizeEventType(input.eventType);
  const orgId = normalizeUuid(input.orgId, 'orgId');
  const template = getSaaSNotificationTemplate(eventType);
  const title = normalizeOptionalString(input.title, 'title', 160) ?? template.title;
  const message = normalizeOptionalString(input.message, 'message', 1000) ?? template.message;
  const actionUrl = normalizeOptionalString(input.actionUrl, 'actionUrl', 2048);
  const sendAfter = normalizeIsoDate(input.sendAfter, 'sendAfter');
  const idempotencyKey = normalizeOptionalString(input.idempotencyKey, 'idempotencyKey', 160);
  const payload = normalizePayload(input.payload);
  const normalizedRecipients = input.recipients.map(normalizeRecipient);
  const uniqueRecipients = new Map<string, Required<SaaSNotificationRecipient>>();

  for (const recipient of normalizedRecipients) {
    uniqueRecipients.set(recipientKey(recipient), recipient);
  }

  const notifications: SaaSNotificationInsert[] = [];
  const emailQueue: SaaSEmailQueueInsert[] = [];

  for (const recipient of uniqueRecipients.values()) {
    const metadata = buildRecipientMetadata(recipient, payload);

    if (recipient.channels.includes('in_app') && recipient.userId) {
      notifications.push({
        org_id: orgId,
        user_id: recipient.userId,
        notification_type: eventType,
        title,
        message,
        action_url: actionUrl,
        metadata,
        idempotency_key: buildIdempotencyKey(idempotencyKey, eventType, 'in_app', recipient),
      });
    }

    if (recipient.channels.includes('email') && recipient.email) {
      emailQueue.push({
        org_id: orgId,
        recipient_user_id: recipient.userId,
        recipient_email: recipient.email,
        template_key: template.templateKey,
        subject: template.subject,
        event_type: eventType,
        payload: {
          ...metadata,
          title,
          message,
          action_url: actionUrl,
        },
        status: 'queued',
        send_after: sendAfter,
        idempotency_key: buildIdempotencyKey(idempotencyKey, eventType, 'email', recipient),
      });
    }
  }

  return {
    eventType,
    notifications,
    emailQueue,
  };
}

export function buildBillingPaymentFailedNotification(
  input: BillingPaymentFailedNotificationInput
): SaaSNotificationDispatch {
  return buildSaaSNotificationDispatch({
    eventType: 'billing_payment_failed',
    orgId: input.orgId,
    recipients: input.recipients,
    actionUrl: input.actionUrl ?? null,
    idempotencyKey: input.idempotencyKey ?? input.invoiceId ?? null,
    payload: {
      invoiceId: input.invoiceId ?? null,
      provider: input.provider ?? null,
      amountTwd: input.amountTwd ?? null,
      failedAt: input.failedAt ?? null,
    },
  });
}

export function buildAIQuotaReachedNotification(
  input: AIQuotaReachedNotificationInput
): SaaSNotificationDispatch {
  return buildSaaSNotificationDispatch({
    eventType: 'ai_quota_reached',
    orgId: input.orgId,
    recipients: input.recipients,
    actionUrl: input.actionUrl ?? null,
    idempotencyKey: input.idempotencyKey ?? `${input.orgId}:${input.periodStart}:${input.periodEnd}`,
    payload: {
      used: input.used,
      limit: input.limit,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  });
}

export function buildTrialEndingNotification(
  input: TrialEndingNotificationInput
): SaaSNotificationDispatch {
  return buildSaaSNotificationDispatch({
    eventType: 'trial_ending',
    orgId: input.orgId,
    recipients: input.recipients,
    actionUrl: input.actionUrl ?? null,
    idempotencyKey: input.idempotencyKey ?? `${input.orgId}:${input.trialEnd}`,
    payload: {
      trialEnd: input.trialEnd,
      daysUntilTrialEnd: input.daysUntilTrialEnd,
    },
  });
}

export function buildPlatformAnnouncementNotification(
  input: PlatformAnnouncementNotificationInput
): SaaSNotificationDispatch {
  return buildSaaSNotificationDispatch({
    eventType: 'platform_announcement',
    orgId: input.orgId,
    recipients: input.recipients,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    sendAfter: input.sendAfter ?? null,
    idempotencyKey: input.idempotencyKey ?? input.announcementId ?? null,
    payload: {
      announcementId: input.announcementId ?? null,
    },
  });
}

async function insertRows(
  client: SaaSNotificationQueueClient,
  table: string,
  rows: object[]
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const { error } = await client.from(table).insert(rows as Record<string, unknown>[]).select('id');
  if (error) {
    throw new Error(error.message || `Failed to enqueue ${table}.`);
  }

  return rows.length;
}

export function createSaaSNotificationQueueRepository(
  client: SaaSNotificationQueueClient
): SaaSNotificationQueueRepository {
  return {
    async enqueue(dispatch) {
      const notificationCount = await insertRows(client, 'notifications', dispatch.notifications);
      const emailQueueCount = await insertRows(client, 'email_queue', dispatch.emailQueue);

      return {
        notificationCount,
        emailQueueCount,
      };
    },
  };
}

export function createDefaultSaaSNotificationQueueRepository() {
  return createSaaSNotificationQueueRepository(createUntypedAdminClient());
}
