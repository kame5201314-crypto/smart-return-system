import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';

export type SaasSurface = 'marketing' | 'app' | 'admin';

export interface SaasSurfaceOrigins {
  marketing: string | null;
  app: string | null;
  admin: string | null;
  enabled: boolean;
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const MARKETING_PATHS = new Set([
  '/',
  '/contact',
  '/opengraph-image',
  '/pricing',
  '/robots.txt',
  '/sitemap.xml',
]);

const APP_PATHS = new Set([
  '/dashboard',
  '/forgot-password',
  '/logistics',
  '/login',
  '/onboarding',
  '/orders',
  '/reset-password',
  '/signup',
]);

const APP_PREFIXES = [
  '/account',
  '/analytics',
  '/auth',
  '/invite',
  '/pickup',
  '/portal',
  '/returns',
  '/settings',
  '/shopee-returns',
  '/tutorial',
];

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || [
    'replace_with',
    'replace-with',
    'your_',
    'your-',
    'placeholder',
    'change_me',
    'change-me',
  ].some((marker) => normalized.includes(marker));
}

function matchesPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function normalizeExplicitInternalNextPath(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === '/admin') return '/internal';

  const normalized = normalizeInternalNextPath(trimmed);
  return normalized === trimmed ? normalized : null;
}

export function normalizeConfiguredSurfaceOrigin(
  value: unknown,
  nodeEnv: string | undefined = process.env.NODE_ENV
): string | null {
  if (typeof value !== 'string' || isPlaceholder(value)) return null;

  try {
    const url = new URL(value.trim());
    const isDevelopment = (nodeEnv || '').trim().toLowerCase() === 'development';
    const validProtocol = url.protocol === 'https:' || (
      isDevelopment
      && url.protocol === 'http:'
      && LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())
    );

    if (
      !validProtocol
      || !url.hostname
      || url.username
      || url.password
      || (url.pathname !== '/' && url.pathname !== '')
      || url.search
      || url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSaasSurfaceOrigins(
  env: Record<string, string | undefined> = process.env
): SaasSurfaceOrigins {
  const app = normalizeConfiguredSurfaceOrigin(env.NEXT_PUBLIC_APP_URL, env.NODE_ENV);
  const marketingConfigured = Boolean(env.NEXT_PUBLIC_MARKETING_URL?.trim());
  const adminConfigured = Boolean(env.NEXT_PUBLIC_ADMIN_URL?.trim());
  const marketingValue = marketingConfigured
    ? normalizeConfiguredSurfaceOrigin(env.NEXT_PUBLIC_MARKETING_URL, env.NODE_ENV)
    : app;
  const adminValue = adminConfigured
    ? normalizeConfiguredSurfaceOrigin(env.NEXT_PUBLIC_ADMIN_URL, env.NODE_ENV)
    : app;
  const configurationValid = Boolean(
    app
    && (!marketingConfigured || marketingValue)
    && (!adminConfigured || adminValue)
  );

  return {
    marketing: configurationValid ? marketingValue : null,
    app: configurationValid ? app : null,
    admin: configurationValid ? adminValue : null,
    enabled: configurationValid && (marketingConfigured || adminConfigured),
  };
}

export function classifySaasPageSurface(pathname: string): SaasSurface | null {
  if (matchesPath(pathname, '/admin') || matchesPath(pathname, '/internal')) {
    return 'admin';
  }

  if (
    MARKETING_PATHS.has(pathname)
    || matchesPath(pathname, '/features')
    || matchesPath(pathname, '/legal')
  ) {
    return 'marketing';
  }

  if (APP_PATHS.has(pathname) || APP_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return 'app';
  }

  return null;
}

function buildTrustedRedirect(
  targetOrigin: string,
  pathname: string,
  search: string
): string {
  const target = new URL(targetOrigin);
  target.pathname = pathname;
  target.search = search;
  target.hash = '';
  return target.toString();
}

export function resolveSaasSurfaceRedirect(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env
): string | null {
  const origins = resolveSaasSurfaceOrigins(env);

  let source: URL;
  try {
    source = new URL(requestUrl);
  } catch {
    return null;
  }

  // Older admin links used the shared merchant login route with an internal
  // `next` parameter. Canonicalize that intent before the generic `/login`
  // app-surface rule so an admin session is created on the trusted admin host
  // instead of being lost during the subsequent cross-host redirect.
  if (source.pathname === '/login' && origins.admin) {
    const safeNext = normalizeExplicitInternalNextPath(source.searchParams.get('next'));
    if (safeNext) {
      return buildTrustedRedirect(
        origins.admin,
        '/admin/login',
        `?next=${encodeURIComponent(safeNext)}`
      );
    }
  }

  if (!origins.enabled) return null;

  if (source.origin === origins.admin && source.pathname === '/') {
    return buildTrustedRedirect(origins.admin, '/admin', '');
  }

  if (source.origin === origins.admin && source.pathname === '/login') {
    const safeNext = normalizeInternalNextPath(source.searchParams.get('next'));
    return buildTrustedRedirect(
      origins.admin,
      '/admin/login',
      `?next=${encodeURIComponent(safeNext)}`
    );
  }

  if (
    source.origin === origins.app
    && origins.marketing !== origins.app
    && source.pathname === '/'
  ) {
    return buildTrustedRedirect(origins.app, '/analytics', '');
  }

  const surface = classifySaasPageSurface(source.pathname);
  if (!surface) return null;

  const targetOrigin = origins[surface];
  if (!targetOrigin || targetOrigin === source.origin) return null;

  return buildTrustedRedirect(targetOrigin, source.pathname, source.search);
}
