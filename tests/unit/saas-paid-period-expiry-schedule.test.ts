import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const vercelConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')
) as { crons?: Array<{ path?: string; schedule?: string }> };
const cronDrillSource = readFileSync(
  resolve(process.cwd(), 'scripts/maintenance/cron-drill.mjs'),
  'utf8'
);

describe('SaaS paid-period expiry schedule', () => {
  it('runs the shared entitlement expiry cron hourly', () => {
    expect(vercelConfig.crons).toEqual(expect.arrayContaining([
      {
        path: '/api/cron/saas/trial-expiry',
        schedule: '20 * * * *',
      },
    ]));
  });

  it('keeps the mutating expiry drill explicit-only', () => {
    expect(cronDrillSource).toContain('const safeDefaultTargets = [');
    expect(cronDrillSource).toContain('const explicitMutationTargets = [');
    expect(cronDrillSource).toContain("'/api/cron/saas/trial-expiry'");
    expect(cronDrillSource).toContain(
      '? [...safeDefaultTargets, ...explicitMutationTargets]'
    );
    expect(cronDrillSource).toContain(': safeDefaultTargets');
  });
});
