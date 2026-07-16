const PUBLIC_ROUTE_EXACT_PATHS = new Set([
  '/',
  '/admin/login',
  '/contact',
  '/forgot-password',
  '/login',
  '/opengraph-image',
  '/pricing',
  '/robots.txt',
  '/sitemap.xml',
  '/signup',
]);

const PUBLIC_ROUTE_PREFIXES = [
  '/auth',
  '/features',
  '/invite',
  '/legal',
  '/portal',
];

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);

  if (PUBLIC_ROUTE_EXACT_PATHS.has(normalized)) {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}
