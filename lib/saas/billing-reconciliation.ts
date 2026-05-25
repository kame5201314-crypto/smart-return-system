import type {
  BillingEventStatus,
  BillingProvider,
} from '@/lib/saas/ui-backend-contracts';

export type BillingEventRetryBlockReason =
  | 'already_processed'
  | 'ignored_event'
  | 'missing_provider_event_id'
  | 'unsupported_provider'
  | 'non_retryable_event_type'
  | 'provider_replay_not_enabled';

export interface BillingEventRetrySource {
  id: string;
  orgId: string;
  provider: string;
  eventType: string;
  status: string;
  providerEventId: string | null;
  createdAt: string;
}

export interface BillingEventRetryDecision {
  eventId: string;
  orgId: string;
  provider: BillingProvider;
  eventType: string;
  status: BillingEventStatus;
  providerEventId: string | null;
  retryEnabled: boolean;
  canRetry: boolean;
  dryRunOnly: boolean;
  blockedReason: BillingEventRetryBlockReason | null;
  operation: 'provider_webhook_replay' | 'no_op';
  message: string;
}

export interface BillingEventRetryOptions {
  providerReplayEnabled?: boolean;
  retryableProviders?: BillingProvider[];
}

export interface BillingProviderEventSnapshot {
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  occurredAt: string | null;
  amountTwd?: number | null;
  status?: string | null;
  orgId?: string | null;
}

export type BillingReconciliationIssueType =
  | 'local_failed'
  | 'local_unprocessed'
  | 'duplicate_local_event'
  | 'missing_local_event'
  | 'missing_provider_event';

export interface BillingReconciliationIssue {
  type: BillingReconciliationIssueType;
  severity: 'info' | 'warning' | 'critical';
  provider: BillingProvider;
  providerEventId: string | null;
  localEventId: string | null;
  orgId: string | null;
  message: string;
  nextAction:
    | 'manual_review'
    | 'record_provider_event'
    | 'verify_provider_ledger'
    | 'none';
}

export interface BillingEventReconciliationView {
  summary: {
    localEvents: number;
    providerEvents: number;
    issues: number;
    criticalIssues: number;
    warningIssues: number;
    retryCandidates: number;
  };
  issues: BillingReconciliationIssue[];
}

export interface BillingEventReconciliationOptions {
  now?: Date;
  staleReceivedAfterHours?: number;
  providerSnapshotComplete?: boolean;
}

const BILLING_PROVIDERS: readonly BillingProvider[] = ['manual', 'ecpay', 'stripe', 'tappay'];
const BILLING_EVENT_STATUSES: readonly BillingEventStatus[] = [
  'received',
  'processed',
  'failed',
  'ignored',
];
const DEFAULT_RETRYABLE_PROVIDERS: BillingProvider[] = ['ecpay'];
const DEFAULT_STALE_RECEIVED_HOURS = 24;

function normalizeAllowed<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string
): T {
  const normalized = value.trim().toLowerCase();
  if (allowedValues.includes(normalized as T)) {
    return normalized as T;
  }
  throw new Error(`Invalid ${fieldName}: ${value}`);
}

function normalizeBillingProvider(value: string): BillingProvider {
  return normalizeAllowed(value, BILLING_PROVIDERS, 'billing provider');
}

function normalizeBillingEventStatus(value: string): BillingEventStatus {
  return normalizeAllowed(value, BILLING_EVENT_STATUSES, 'billing event status');
}

function hasProviderEventId(event: BillingEventRetrySource): boolean {
  return typeof event.providerEventId === 'string' && event.providerEventId.trim().length > 0;
}

function isRetryableEventType(event: BillingEventRetrySource): boolean {
  const normalized = event.eventType.trim().toLowerCase();
  if (!normalized || normalized.startsWith('manual.')) {
    return false;
  }
  return normalized.includes('payment') || normalized.includes('invoice') || normalized.includes('subscription');
}

function retryBlocked(
  event: BillingEventRetrySource,
  provider: BillingProvider,
  status: BillingEventStatus,
  blockedReason: BillingEventRetryBlockReason,
  message: string
): BillingEventRetryDecision {
  return {
    eventId: event.id,
    orgId: event.orgId,
    provider,
    eventType: event.eventType,
    status,
    providerEventId: event.providerEventId,
    retryEnabled: false,
    canRetry: false,
    dryRunOnly: true,
    blockedReason,
    operation: 'no_op',
    message,
  };
}

function eventKey(provider: BillingProvider, providerEventId: string): string {
  return `${provider}:${providerEventId.trim()}`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(left: Date, right: Date): number {
  return Math.abs(left.getTime() - right.getTime()) / (60 * 60 * 1000);
}

export function buildBillingEventRetryDecision(
  event: BillingEventRetrySource,
  options: BillingEventRetryOptions = {}
): BillingEventRetryDecision {
  const provider = normalizeBillingProvider(event.provider);
  const status = normalizeBillingEventStatus(event.status);
  const retryableProviders = options.retryableProviders ?? DEFAULT_RETRYABLE_PROVIDERS;

  if (status === 'processed') {
    return retryBlocked(
      event,
      provider,
      status,
      'already_processed',
      'Processed billing events must not be replayed.'
    );
  }

  if (status === 'ignored') {
    return retryBlocked(
      event,
      provider,
      status,
      'ignored_event',
      'Ignored billing events require manual review, not replay.'
    );
  }

  if (!hasProviderEventId(event)) {
    return retryBlocked(
      event,
      provider,
      status,
      'missing_provider_event_id',
      'Billing events without a provider event id cannot be replayed safely.'
    );
  }

  if (!retryableProviders.includes(provider)) {
    return retryBlocked(
      event,
      provider,
      status,
      'unsupported_provider',
      'This billing provider does not have an approved replay adapter.'
    );
  }

  if (!isRetryableEventType(event)) {
    return retryBlocked(
      event,
      provider,
      status,
      'non_retryable_event_type',
      'This event type is not in the approved retry allowlist.'
    );
  }

  if (options.providerReplayEnabled !== true) {
    return retryBlocked(
      event,
      provider,
      status,
      'provider_replay_not_enabled',
      'Provider replay is disabled; use this decision as a dry-run only.'
    );
  }

  return {
    eventId: event.id,
    orgId: event.orgId,
    provider,
    eventType: event.eventType,
    status,
    providerEventId: event.providerEventId,
    retryEnabled: true,
    canRetry: true,
    dryRunOnly: false,
    blockedReason: null,
    operation: 'provider_webhook_replay',
    message: 'This event can be replayed through the provider adapter.',
  };
}

export function buildBillingEventReconciliationView(
  localEvents: BillingEventRetrySource[],
  providerEvents: BillingProviderEventSnapshot[] = [],
  options: BillingEventReconciliationOptions = {}
): BillingEventReconciliationView {
  const now = options.now ?? new Date();
  const staleAfterHours = options.staleReceivedAfterHours ?? DEFAULT_STALE_RECEIVED_HOURS;
  const providerSnapshotComplete = options.providerSnapshotComplete ?? false;
  const issues: BillingReconciliationIssue[] = [];
  const localByProviderEventId = new Map<string, BillingEventRetrySource[]>();

  for (const event of localEvents) {
    const provider = normalizeBillingProvider(event.provider);
    const status = normalizeBillingEventStatus(event.status);

    if (hasProviderEventId(event)) {
      const key = eventKey(provider, event.providerEventId as string);
      localByProviderEventId.set(key, [...(localByProviderEventId.get(key) ?? []), event]);
    }

    if (status === 'failed') {
      issues.push({
        type: 'local_failed',
        severity: 'warning',
        provider,
        providerEventId: event.providerEventId,
        localEventId: event.id,
        orgId: event.orgId,
        message: 'Local billing event processing failed and needs review.',
        nextAction: 'manual_review',
      });
    }

    const createdAt = parseDate(event.createdAt);
    if (status === 'received' && createdAt && hoursBetween(createdAt, now) >= staleAfterHours) {
      issues.push({
        type: 'local_unprocessed',
        severity: 'warning',
        provider,
        providerEventId: event.providerEventId,
        localEventId: event.id,
        orgId: event.orgId,
        message: `Local billing event is still received after ${staleAfterHours} hours.`,
        nextAction: 'manual_review',
      });
    }
  }

  for (const [key, events] of localByProviderEventId) {
    if (events.length <= 1) {
      continue;
    }
    const first = events[0];
    const provider = normalizeBillingProvider(first.provider);
    issues.push({
      type: 'duplicate_local_event',
      severity: 'critical',
      provider,
      providerEventId: first.providerEventId,
      localEventId: first.id,
      orgId: first.orgId,
      message: `Duplicate local billing events share provider event key ${key}.`,
      nextAction: 'manual_review',
    });
  }

  const providerKeys = new Set<string>();
  for (const snapshot of providerEvents) {
    const key = eventKey(snapshot.provider, snapshot.providerEventId);
    providerKeys.add(key);
    if (!localByProviderEventId.has(key)) {
      issues.push({
        type: 'missing_local_event',
        severity: 'critical',
        provider: snapshot.provider,
        providerEventId: snapshot.providerEventId,
        localEventId: null,
        orgId: snapshot.orgId ?? null,
        message: 'Provider ledger contains an event that is missing from billing_events.',
        nextAction: 'record_provider_event',
      });
    }
  }

  if (providerSnapshotComplete) {
    for (const [key, events] of localByProviderEventId) {
      if (providerKeys.has(key)) {
        continue;
      }
      const first = events[0];
      issues.push({
        type: 'missing_provider_event',
        severity: 'info',
        provider: normalizeBillingProvider(first.provider),
        providerEventId: first.providerEventId,
        localEventId: first.id,
        orgId: first.orgId,
        message: 'Local billing event was not found in the provider reconciliation snapshot.',
        nextAction: 'verify_provider_ledger',
      });
    }
  }

  const retryCandidates = localEvents.filter((event) =>
    buildBillingEventRetryDecision(event, { providerReplayEnabled: true }).canRetry
  ).length;

  return {
    summary: {
      localEvents: localEvents.length,
      providerEvents: providerEvents.length,
      issues: issues.length,
      criticalIssues: issues.filter((issue) => issue.severity === 'critical').length,
      warningIssues: issues.filter((issue) => issue.severity === 'warning').length,
      retryCandidates,
    },
    issues,
  };
}
