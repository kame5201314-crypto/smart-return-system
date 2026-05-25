import {
  canWriteSaaSOrgData,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';

export type SaaSOnboardingStepId =
  | 'organization_profile'
  | 'return_policy'
  | 'team_setup'
  | 'first_return'
  | 'ai_review'
  | 'complete';

export type SaaSOnboardingStepStatus =
  | 'complete'
  | 'current'
  | 'pending'
  | 'blocked';

export type SaaSOnboardingErrorCode =
  | 'invalid_request'
  | 'role_forbidden'
  | 'subscription_inactive'
  | 'operation_failed';

export interface SaaSOnboardingViewInput {
  org: {
    id: string;
    name: string;
    onboardingCompletedAt?: string | null;
  };
  signals: {
    returnPolicyConfigured: boolean;
    memberCount: number;
    pendingInviteCount: number;
    returnCount: number;
    aiUsageCount: number;
  };
  actions?: {
    canComplete?: boolean;
    disabledReason?: string | null;
  };
}

export interface SaaSOnboardingStep {
  id: SaaSOnboardingStepId;
  title: string;
  description: string;
  required: boolean;
  complete: boolean;
  status: SaaSOnboardingStepStatus;
}

export interface SaaSOnboardingView {
  org: {
    id: string;
    name: string;
    onboardingCompletedAt: string | null;
  };
  summary: {
    totalSteps: number;
    completedSteps: number;
    percentComplete: number;
    currentStepId: SaaSOnboardingStepId | null;
  };
  steps: SaaSOnboardingStep[];
  actions: {
    canComplete: boolean;
    disabledReason?: string;
  };
}

export interface SaaSOnboardingCompletionInput {
  orgId: string;
  actorUserId: string;
  completedAt: string;
  metadata: Record<string, unknown>;
}

export interface SaaSOnboardingCompletionResult {
  orgId: string;
  onboardingCompletedAt: string;
  auditLogId: string | null;
}

export interface SaaSOnboardingRepository {
  completeOnboarding(
    input: SaaSOnboardingCompletionInput
  ): Promise<SaaSOnboardingCompletionResult>;
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

interface StepDefinition {
  id: SaaSOnboardingStepId;
  title: string;
  description: string;
  required: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: 'organization_profile',
    title: 'Organization profile',
    description: 'Confirm the workspace profile before inviting the team.',
    required: true,
  },
  {
    id: 'return_policy',
    title: 'Return policy',
    description: 'Configure the basic return policy used by the team and portal.',
    required: true,
  },
  {
    id: 'team_setup',
    title: 'Team setup',
    description: 'Invite at least one team member or keep a pending invite ready.',
    required: true,
  },
  {
    id: 'first_return',
    title: 'First return',
    description: 'Create or import the first return request.',
    required: true,
  },
  {
    id: 'ai_review',
    title: 'AI review',
    description: 'Run the first return AI analysis to verify the core workflow.',
    required: true,
  },
  {
    id: 'complete',
    title: 'Complete onboarding',
    description: 'Mark the workspace onboarding checklist as complete.',
    required: true,
  },
];

export class SaaSOnboardingError extends Error {
  constructor(
    public readonly code: SaaSOnboardingErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSOnboardingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new SaaSOnboardingError('invalid_request', 400, `${field} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new SaaSOnboardingError('invalid_request', 400, `${field} is too long.`);
  }
  return normalized;
}

function normalizeUuid(value: unknown, field: string): string {
  const normalized = requireString(value, field, 64);
  if (!UUID_PATTERN.test(normalized)) {
    throw new SaaSOnboardingError(
      'invalid_request',
      400,
      `${field} must be a valid UUID.`
    );
  }
  return normalized;
}

function normalizeIsoDate(value: unknown, field: string, now: Date): string {
  const normalized = stringOrNull(value) ?? now.toISOString();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new SaaSOnboardingError(
      'invalid_request',
      400,
      `${field} must be an ISO date string.`
    );
  }
  return parsed.toISOString();
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new SaaSOnboardingError('invalid_request', 400, 'metadata must be an object.');
  }
  return value;
}

function normalizeCount(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new SaaSOnboardingError(
      'invalid_request',
      400,
      `${field} must be a non-negative number.`
    );
  }
  return Math.floor(value);
}

function normalizeRpcResult(data: unknown): SaaSOnboardingCompletionResult {
  if (!isRecord(data)) {
    throw new Error('Onboarding completion RPC returned invalid data.');
  }

  const orgId = stringOrNull(data.org_id);
  const onboardingCompletedAt = stringOrNull(data.onboarding_completed_at);
  if (!orgId || !onboardingCompletedAt) {
    throw new Error('Onboarding completion RPC did not return completion data.');
  }

  return {
    orgId,
    onboardingCompletedAt,
    auditLogId: stringOrNull(data.audit_log_id),
  };
}

function isStepComplete(
  id: SaaSOnboardingStepId,
  input: SaaSOnboardingViewInput
): boolean {
  const signals = input.signals;
  if (id === 'organization_profile') {
    return Boolean(input.org.id.trim() && input.org.name.trim());
  }
  if (id === 'return_policy') {
    return signals.returnPolicyConfigured;
  }
  if (id === 'team_setup') {
    return signals.memberCount > 1 || signals.pendingInviteCount > 0;
  }
  if (id === 'first_return') {
    return signals.returnCount > 0;
  }
  if (id === 'ai_review') {
    return signals.aiUsageCount > 0;
  }
  return Boolean(input.org.onboardingCompletedAt);
}

function buildSteps(input: SaaSOnboardingViewInput): SaaSOnboardingStep[] {
  const completionById = new Map(
    STEP_DEFINITIONS.map((step) => [step.id, isStepComplete(step.id, input)])
  );
  const firstIncompleteRequired = STEP_DEFINITIONS.find(
    (step) => step.required && !completionById.get(step.id)
  )?.id ?? null;

  return STEP_DEFINITIONS.map((step) => {
    const complete = completionById.get(step.id) === true;
    let status: SaaSOnboardingStepStatus = 'pending';

    if (complete) {
      status = 'complete';
    } else if (step.id === 'complete' && firstIncompleteRequired === 'complete') {
      status = 'current';
    } else if (step.id === firstIncompleteRequired) {
      status = 'current';
    }

    return {
      ...step,
      complete,
      status,
    };
  });
}

export function buildSaaSOnboardingView(
  input: SaaSOnboardingViewInput
): SaaSOnboardingView {
  const memberCount = normalizeCount(input.signals.memberCount, 'memberCount');
  const pendingInviteCount = normalizeCount(
    input.signals.pendingInviteCount,
    'pendingInviteCount'
  );
  const returnCount = normalizeCount(input.signals.returnCount, 'returnCount');
  const aiUsageCount = normalizeCount(input.signals.aiUsageCount, 'aiUsageCount');
  const normalizedInput: SaaSOnboardingViewInput = {
    ...input,
    org: {
      id: requireString(input.org.id, 'org.id', 64),
      name: requireString(input.org.name, 'org.name', 160),
      onboardingCompletedAt: input.org.onboardingCompletedAt ?? null,
    },
    signals: {
      returnPolicyConfigured: input.signals.returnPolicyConfigured === true,
      memberCount,
      pendingInviteCount,
      returnCount,
      aiUsageCount,
    },
  };
  const steps = buildSteps(normalizedInput);
  const completedSteps = steps.filter((step) => step.complete).length;
  const currentStepId = steps.find((step) => step.status === 'current')?.id ?? null;
  const prerequisitesComplete = steps
    .filter((step) => step.id !== 'complete' && step.required)
    .every((step) => step.complete);
  const callerCanComplete = input.actions?.canComplete === true;
  const canComplete =
    !normalizedInput.org.onboardingCompletedAt && prerequisitesComplete && callerCanComplete;

  return {
    org: {
      id: normalizedInput.org.id,
      name: normalizedInput.org.name,
      onboardingCompletedAt: normalizedInput.org.onboardingCompletedAt ?? null,
    },
    summary: {
      totalSteps: steps.length,
      completedSteps,
      percentComplete: Math.round((completedSteps / steps.length) * 100),
      currentStepId,
    },
    steps,
    actions: canComplete
      ? {
          canComplete: true,
        }
      : {
          canComplete: false,
          disabledReason:
            input.actions?.disabledReason ??
            (normalizedInput.org.onboardingCompletedAt
              ? 'Onboarding is already complete.'
              : prerequisitesComplete
                ? 'Owner or admin write access is required to complete onboarding.'
                : 'Complete the required onboarding steps first.'),
        },
  };
}

export function normalizeSaaSOnboardingCompletionRequest(
  value: unknown,
  context: SaaSOrgContext,
  now = new Date()
): SaaSOnboardingCompletionInput {
  const body = value === undefined || value === null ? {} : value;
  if (!isRecord(body)) {
    throw new SaaSOnboardingError('invalid_request', 400, 'Request body must be an object.');
  }

  return {
    orgId: normalizeUuid(context.orgId, 'orgId'),
    actorUserId: normalizeUuid(context.userId, 'actorUserId'),
    completedAt: normalizeIsoDate(body.completedAt, 'completedAt', now),
    metadata: normalizeMetadata(body.metadata),
  };
}

export function assertCanCompleteSaaSOnboarding(context: SaaSOrgContext): void {
  if (context.role !== 'owner' && context.role !== 'admin') {
    throw new SaaSOnboardingError(
      'role_forbidden',
      403,
      'Owner or admin role is required to complete onboarding.'
    );
  }

  if (!canWriteSaaSOrgData(context)) {
    throw new SaaSOnboardingError(
      'subscription_inactive',
      402,
      `Organization status ${context.orgStatus} does not allow onboarding writes.`
    );
  }
}

export function buildCompleteSaaSOnboardingRpcArgs(
  input: SaaSOnboardingCompletionInput
): Record<string, unknown> {
  return {
    p_org_id: input.orgId,
    p_actor_user_id: input.actorUserId,
    p_completed_at: input.completedAt,
    p_metadata: input.metadata,
  };
}

export function createSaaSOnboardingRepository(
  client: SupabaseRpcClient
): SaaSOnboardingRepository {
  return {
    async completeOnboarding(input) {
      const { data, error } = await client.rpc(
        'complete_organization_onboarding',
        buildCompleteSaaSOnboardingRpcArgs(input)
      );

      if (error) {
        throw new SaaSOnboardingError(
          'operation_failed',
          500,
          error.message || 'Failed to complete onboarding.'
        );
      }

      return normalizeRpcResult(data);
    },
  };
}

export async function completeSaaSOnboarding(
  value: unknown,
  options: {
    context: SaaSOrgContext;
    repository: SaaSOnboardingRepository;
    now?: Date;
  }
): Promise<SaaSOnboardingCompletionResult> {
  assertCanCompleteSaaSOnboarding(options.context);
  const input = normalizeSaaSOnboardingCompletionRequest(
    value,
    options.context,
    options.now
  );

  try {
    return await options.repository.completeOnboarding(input);
  } catch (error) {
    if (error instanceof SaaSOnboardingError) {
      throw error;
    }

    throw new SaaSOnboardingError(
      'operation_failed',
      500,
      'Failed to complete onboarding.'
    );
  }
}
