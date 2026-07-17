import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('login page runtime feature flags', () => {
  it('renders dynamically so Vercel rollout flags are not frozen at build time', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/login/page.tsx'), 'utf8');

    expect(source).toContain("export const dynamic = 'force-dynamic'");
    expect(source).toContain('resolveSaaSFeatureFlags');
  });
});
