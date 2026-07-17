export const SELF_SERVICE_TRIAL_RETURN_LIMIT = 50;
export const SELF_SERVICE_TRIAL_IMPORT_ROW_LIMIT = 30;

export type SelfServiceTrialReturnLimitErrorCode =
  | 'trial_return_limit_reached'
  | 'trial_import_row_limit_exceeded'
  | 'trial_return_limit_unavailable';

export class SelfServiceTrialReturnLimitError extends Error {
  constructor(
    public readonly code: SelfServiceTrialReturnLimitErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SelfServiceTrialReturnLimitError';
  }
}

export interface SelfServiceTrialReturnLimitRepository {
  hasSelfServiceTrialClaim(orgId: string): Promise<boolean>;
  countReturns(orgId: string): Promise<number>;
}

export async function assertSelfServiceTrialReturnCapacity(input: {
  orgId: string;
  orgStatus: string;
  additionalReturns: number;
  importRowCount?: number;
  repository: SelfServiceTrialReturnLimitRepository;
}): Promise<void> {
  if (input.orgStatus !== 'trialing') return;

  let applies: boolean;
  try {
    applies = await input.repository.hasSelfServiceTrialClaim(input.orgId);
  } catch {
    throw new SelfServiceTrialReturnLimitError(
      'trial_return_limit_unavailable',
      503,
      'Unable to verify the trial return limit.'
    );
  }
  if (!applies) return;

  if (
    input.importRowCount !== undefined
    && input.importRowCount > SELF_SERVICE_TRIAL_IMPORT_ROW_LIMIT
  ) {
    throw new SelfServiceTrialReturnLimitError(
      'trial_import_row_limit_exceeded',
      400,
      `A trial import can contain at most ${SELF_SERVICE_TRIAL_IMPORT_ROW_LIMIT} rows.`
    );
  }

  let used: number;
  try {
    used = await input.repository.countReturns(input.orgId);
  } catch {
    throw new SelfServiceTrialReturnLimitError(
      'trial_return_limit_unavailable',
      503,
      'Unable to verify the trial return limit.'
    );
  }

  const additionalReturns = Math.max(0, Math.trunc(input.additionalReturns));
  if (used + additionalReturns > SELF_SERVICE_TRIAL_RETURN_LIMIT) {
    throw new SelfServiceTrialReturnLimitError(
      'trial_return_limit_reached',
      402,
      `This trial workspace can contain at most ${SELF_SERVICE_TRIAL_RETURN_LIMIT} returns.`
    );
  }
}
