export interface AIAnalysisCacheDecisionInput {
  cacheEnabled: boolean;
  existingFingerprint?: string | null;
  payloadFingerprint: string;
}

export interface AIAnalysisCacheDecision {
  reuse: boolean;
  reason:
    | 'cache_disabled'
    | 'missing_existing_fingerprint'
    | 'fingerprint_match'
    | 'fingerprint_mismatch';
}

export function isAIAnalysisCacheEnabled(rawValue = process.env.AI_ANALYSIS_CACHE_ENABLED): boolean {
  if (!rawValue) {
    return true;
  }

  return !['0', 'false', 'off', 'no'].includes(rawValue.trim().toLowerCase());
}

export function decideAIAnalysisCacheReuse(
  input: AIAnalysisCacheDecisionInput
): AIAnalysisCacheDecision {
  if (!input.cacheEnabled) {
    return { reuse: false, reason: 'cache_disabled' };
  }

  if (!input.existingFingerprint) {
    return { reuse: false, reason: 'missing_existing_fingerprint' };
  }

  if (input.existingFingerprint === input.payloadFingerprint) {
    return { reuse: true, reason: 'fingerprint_match' };
  }

  return { reuse: false, reason: 'fingerprint_mismatch' };
}
