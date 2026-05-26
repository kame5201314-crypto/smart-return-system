import {
  completeSaaSOnboarding,
  createSaaSOnboardingRepository,
  type SaaSOnboardingCompletionResult,
  type SaaSOnboardingRepository,
} from '@/lib/saas/onboarding';
import {
  getOrgContext,
  type GetOrgContextOptions,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export interface SaaSOnboardingRouteDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  repository?: SaaSOnboardingRepository;
  now?: Date;
}

export type SaaSOnboardingRouteResult = SaaSOnboardingCompletionResult;

function getOnboardingRepository(
  deps: SaaSOnboardingRouteDependencies
): SaaSOnboardingRepository {
  return deps.repository ?? createSaaSOnboardingRepository(createUntypedAdminClient());
}

export async function completeSaaSOnboardingFromRequest(
  payload: unknown,
  deps: SaaSOnboardingRouteDependencies = {}
): Promise<SaaSOnboardingRouteResult> {
  const context = await (deps.getContext ?? getOrgContext)({
    requirements: {
      roles: ['owner', 'admin'],
      writable: true,
    },
  });

  return completeSaaSOnboarding(payload, {
    context,
    repository: getOnboardingRepository(deps),
    now: deps.now,
  });
}
