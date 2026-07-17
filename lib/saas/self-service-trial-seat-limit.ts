export const SELF_SERVICE_TRIAL_SEAT_LIMIT = 1;

export interface SelfServiceTrialSeatLimitRepository {
  hasSelfServiceTrialClaim(orgId: string): Promise<boolean>;
}

export class SelfServiceTrialSeatLimitError extends Error {
  constructor(message = 'Unable to verify the trial seat limit.') {
    super(message);
    this.name = 'SelfServiceTrialSeatLimitError';
  }
}

export interface SelfServiceTrialSeatLimitResolution {
  applies: boolean;
  seatLimit: number | null;
}

export async function resolveSelfServiceTrialSeatLimit(input: {
  orgId: string;
  orgStatus: string;
  planSeatLimit: number | null;
  repository: SelfServiceTrialSeatLimitRepository;
}): Promise<SelfServiceTrialSeatLimitResolution> {
  if (input.orgStatus !== 'trialing') {
    return { applies: false, seatLimit: input.planSeatLimit };
  }

  let applies: boolean;
  try {
    applies = await input.repository.hasSelfServiceTrialClaim(input.orgId);
  } catch {
    throw new SelfServiceTrialSeatLimitError();
  }

  return {
    applies,
    seatLimit: applies ? SELF_SERVICE_TRIAL_SEAT_LIMIT : input.planSeatLimit,
  };
}
