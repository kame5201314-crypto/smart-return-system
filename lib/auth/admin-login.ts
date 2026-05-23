const DEFAULT_ADMIN_USERNAME = 'admin';

type AdminLoginEnv = Record<string, string | undefined>;

function normalizeLoginId(value: string | undefined | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function addLoginId(ids: Set<string>, value: string | undefined | null): void {
  const normalized = normalizeLoginId(value);
  if (normalized) {
    ids.add(normalized);
  }
}

export function getConfiguredAdminUsername(env: AdminLoginEnv = process.env): string {
  return normalizeLoginId(env.ADMIN_USERNAME) ?? DEFAULT_ADMIN_USERNAME;
}

export function getAdminLoginIds(env: AdminLoginEnv = process.env): string[] {
  const ids = new Set<string>();
  const adminUsername = getConfiguredAdminUsername(env);

  addLoginId(ids, adminUsername);
  addLoginId(ids, env.ADMIN_EMAIL);

  if (!adminUsername.includes('@')) {
    addLoginId(ids, `${adminUsername}@example.com`);
  }

  return [...ids];
}

export function isAdminLoginId(input: string, env: AdminLoginEnv = process.env): boolean {
  const normalizedInput = normalizeLoginId(input);
  if (!normalizedInput) return false;

  return getAdminLoginIds(env).includes(normalizedInput);
}
