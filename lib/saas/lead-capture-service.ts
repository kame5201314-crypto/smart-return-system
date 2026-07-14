import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  normalizeSaaSPublicLead,
  SaaSPublicLeadError,
} from '@/lib/saas/lead-capture';
import type { SaaSPublicLeadRepository } from '@/lib/saas/lead-capture-repository';

export type SaaSPublicLeadRepositoryFactory = () => SaaSPublicLeadRepository;

export interface SubmitSaaSPublicLeadOptions {
  env?: Record<string, string | undefined>;
  repository?: SaaSPublicLeadRepository | SaaSPublicLeadRepositoryFactory;
}

export interface SaaSPublicLeadResult {
  accepted: true;
  mode: 'public_lead';
  requestId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHoneypotSubmission(value: unknown): boolean {
  return isRecord(value) && typeof value.website === 'string' && Boolean(value.website.trim());
}

function resolveRepository(
  repository: SaaSPublicLeadRepository | SaaSPublicLeadRepositoryFactory | undefined
): SaaSPublicLeadRepository | undefined {
  if (!repository) return undefined;
  return typeof repository === 'function' ? repository() : repository;
}

export function isSaaSPublicLeadCaptureEnabled(
  env?: Record<string, string | undefined>
): boolean {
  return resolveSaaSFeatureFlags({ env, orgPlan: 'basic' }).public_lead_capture;
}

export async function submitSaaSPublicLead(
  value: unknown,
  options: SubmitSaaSPublicLeadOptions = {}
): Promise<SaaSPublicLeadResult> {
  if (!isSaaSPublicLeadCaptureEnabled(options.env)) {
    throw new SaaSPublicLeadError(
      'feature_disabled',
      403,
      'Public lead capture is not enabled.'
    );
  }

  // Accept bot submissions without touching persistence so the honeypot is not observable.
  if (isHoneypotSubmission(value)) {
    return {
      accepted: true,
      mode: 'public_lead',
      requestId: null,
    };
  }

  const input = normalizeSaaSPublicLead(value);

  let repository: SaaSPublicLeadRepository | undefined;
  try {
    repository = resolveRepository(options.repository);
  } catch {
    throw new SaaSPublicLeadError(
      'not_configured',
      503,
      'Public lead persistence is not configured.'
    );
  }

  if (!repository) {
    throw new SaaSPublicLeadError(
      'not_configured',
      503,
      'Public lead persistence is not configured.'
    );
  }

  try {
    const lead = await repository.createLead(input);
    return {
      accepted: true,
      mode: 'public_lead',
      requestId: lead.id ?? null,
    };
  } catch (error) {
    if (error instanceof SaaSPublicLeadError) throw error;
    throw new SaaSPublicLeadError(
      'request_failed',
      500,
      'Public lead request failed.'
    );
  }
}
