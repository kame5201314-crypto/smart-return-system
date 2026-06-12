import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.smart-return.tw';

const MARKETING_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/features/returns', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/features/ai', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/features/security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/refund', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return MARKETING_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
