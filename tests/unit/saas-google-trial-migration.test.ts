import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/040_saas_google_self_service_trial.sql'
);

describe('Google self-service trial migration', () => {
  const source = fs.readFileSync(migrationPath, 'utf8');

  it('keeps the provisioning RPC service-role only and atomic', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.create_google_self_service_trial');
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.create_google_self_service_trial');
    expect(source).toContain('TO service_role');
    expect(source).not.toContain('TO authenticated');
    expect(source).not.toContain('TO anon');
  });

  it('records one-time claims, terms acceptance, trial end, and audit evidence', () => {
    expect(source).toContain('UNIQUE (user_id)');
    expect(source).toContain('UNIQUE (normalized_email)');
    expect(source).toContain("NOW() + INTERVAL '3 days'");
    expect(source).toContain('terms_accepted_at');
    expect(source).toContain('org.google_self_service_trial_created');
    expect(source).toContain("p_plan NOT IN ('basic', 'growth')");
  });

  it('uses a token-owned atomic reservation for the single trial AI analysis', () => {
    expect(source).toContain('analysis_reserved_at TIMESTAMPTZ');
    expect(source).toContain('analysis_reservation_token UUID');
    expect(source).toContain('analysis_completed_at TIMESTAMPTZ');
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.reserve_google_self_service_trial_ai_analysis'
    );
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.complete_google_self_service_trial_ai_analysis'
    );
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.release_google_self_service_trial_ai_analysis'
    );
    expect(source).toContain("effective_at - INTERVAL '10 minutes'");
    expect(source).toContain('claim.analysis_reservation_token = p_reservation_token');
    expect(source).toContain("'reason', 'limit_reached'");
    expect(source).toContain("'reason', 'in_progress'");
  });

  it('keeps every trial AI reservation RPC service-role only', () => {
    for (const functionName of [
      'reserve_google_self_service_trial_ai_analysis',
      'complete_google_self_service_trial_ai_analysis',
      'release_google_self_service_trial_ai_analysis',
    ]) {
      expect(source).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`);
      expect(source).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`);
    }
    expect(source).not.toContain('TO authenticated');
    expect(source).not.toContain('TO anon');
  });
});
