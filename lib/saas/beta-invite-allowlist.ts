const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return normalized;
}

export function isInviteOnlyBetaEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = env.ENABLE_INVITE_ONLY_BETA?.trim().toLowerCase();
  if (!value) return false;
  if (ENABLED_VALUES.has(value)) return true;
  if (DISABLED_VALUES.has(value)) return false;

  // A malformed explicit value fails closed instead of silently opening Beta.
  return true;
}

export function getBetaInviteEmailAllowlist(
  env: Record<string, string | undefined> = process.env
): ReadonlySet<string> {
  const entries = (env.SAAS_BETA_ALLOWED_EMAILS ?? '')
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter((email): email is string => Boolean(email));

  return new Set(entries);
}

export function isBetaInviteEmailAllowed(
  email: unknown,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!isInviteOnlyBetaEnabled(env)) return true;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return getBetaInviteEmailAllowlist(env).has(normalizedEmail);
}
