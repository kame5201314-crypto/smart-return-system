type DeploymentEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

function normalizeEnvValue(value: string | undefined): string {
  return (value || '').replace(/\\n/g, '').trim();
}

function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function isSupabaseUrlMatchingProject(url: string, projectId: string): boolean {
  if (!url || !projectId) {
    return false;
  }

  return url.toLowerCase().includes(projectId.toLowerCase());
}

export function assertDeploymentSafety(
  env: DeploymentEnv = process.env
): void {
  const appMode = normalizeEnvValue(env.APP_MODE).toLowerCase();
  const supabaseUrl = normalizeEnvValue(env.NEXT_PUBLIC_SUPABASE_URL);
  const expectedProjectId = normalizeEnvValue(env.SUPABASE_PROJECT_ID_EXPECTED);
  const internalProjectId = normalizeEnvValue(env.INTERNAL_SUPABASE_PROJECT_ID);
  const saasProjectId = normalizeEnvValue(env.SAAS_SUPABASE_PROJECT_ID);

  if (!appMode) {
    return;
  }

  if (!['internal', 'saas'].includes(appMode)) {
    throw new Error(
      `Invalid APP_MODE "${appMode}". Expected "internal" or "saas".`
    );
  }

  if (expectedProjectId && !isSupabaseUrlMatchingProject(supabaseUrl, expectedProjectId)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL does not match SUPABASE_PROJECT_ID_EXPECTED (${expectedProjectId}).`
    );
  }

  if (
    appMode === 'saas' &&
    internalProjectId &&
    isSupabaseUrlMatchingProject(supabaseUrl, internalProjectId)
  ) {
    throw new Error('APP_MODE=saas cannot connect to the internal Supabase project.');
  }

  if (
    appMode === 'internal' &&
    saasProjectId &&
    isSupabaseUrlMatchingProject(supabaseUrl, saasProjectId)
  ) {
    throw new Error('APP_MODE=internal cannot connect to the SaaS Supabase project.');
  }

  if (appMode === 'internal' && parseBooleanFlag(env.ENABLE_PUBLIC_SIGNUP)) {
    throw new Error('APP_MODE=internal cannot enable public signup.');
  }
}
