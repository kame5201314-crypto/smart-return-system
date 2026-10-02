export interface AIAnalysisCacheDecisionInput {
  cacheEnabled: boolean;
  existingFingerprint?: string | null;
  payloadFingerprint: string;
}

// Reconciliation can fix headline totals without regenerating the analysis.
// Check the original input snapshot too, so incomplete narratives stay stale.
export function isAIReportDatasetStale(rawPrompt: unknown, expectedReturns: number): boolean {
  try {
    const snapshot = typeof rawPrompt === 'string' ? JSON.parse(rawPrompt) : rawPrompt;
    const counts = snapshot?.dataset_counts;
    return !counts
      || typeof counts.official_returns !== 'number'
      || typeof counts.shopee_returns !== 'number'
      || counts.official_returns + counts.shopee_returns !== expectedReturns;
  } catch {
    return true;
  }
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
