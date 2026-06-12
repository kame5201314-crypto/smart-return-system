import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smart-return.tw';

// Marketing/legal pages are crawlable; authenticated app, platform admin,
// and API surfaces are excluded.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/internal/',
          '/admin/',
          '/analytics',
          '/dashboard',
          '/logistics',
          '/onboarding',
          '/orders',
          '/pickup',
          '/returns',
          '/settings',
          '/shopee-returns',
          '/portal',
          '/invite/',
          '/login',
          '/tutorial/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
