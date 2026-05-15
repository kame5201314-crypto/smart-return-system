import { describe, expect, it } from 'vitest';

import { assertDeploymentSafety } from '@/lib/config/deployment-safety';

describe('deployment safety guard', () => {
  const baseEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://internal-ref.supabase.co',
  };

  it('does not block existing deployments when APP_MODE is unset', () => {
    expect(() => assertDeploymentSafety(baseEnv)).not.toThrow();
  });

  it('rejects invalid APP_MODE values', () => {
    expect(() =>
      assertDeploymentSafety({ ...baseEnv, APP_MODE: 'preview' })
    ).toThrow(/Invalid APP_MODE/);
  });

  it('blocks SaaS deployments from using the internal Supabase project', () => {
    expect(() =>
      assertDeploymentSafety({
        ...baseEnv,
        APP_MODE: 'saas',
        INTERNAL_SUPABASE_PROJECT_ID: 'internal-ref',
      })
    ).toThrow(/cannot connect to the internal Supabase project/);
  });

  it('blocks internal deployments from using the SaaS Supabase project', () => {
    expect(() =>
      assertDeploymentSafety({
        NEXT_PUBLIC_SUPABASE_URL: 'https://saas-ref.supabase.co',
        APP_MODE: 'internal',
        SAAS_SUPABASE_PROJECT_ID: 'saas-ref',
      })
    ).toThrow(/cannot connect to the SaaS Supabase project/);
  });

  it('blocks internal deployments when public signup is enabled', () => {
    expect(() =>
      assertDeploymentSafety({
        ...baseEnv,
        APP_MODE: 'internal',
        ENABLE_PUBLIC_SIGNUP: 'true',
      })
    ).toThrow(/cannot enable public signup/);
  });

  it('enforces the expected Supabase project id when configured', () => {
    expect(() =>
      assertDeploymentSafety({
        ...baseEnv,
        APP_MODE: 'internal',
        SUPABASE_PROJECT_ID_EXPECTED: 'another-ref',
      })
    ).toThrow(/does not match SUPABASE_PROJECT_ID_EXPECTED/);
  });
});
