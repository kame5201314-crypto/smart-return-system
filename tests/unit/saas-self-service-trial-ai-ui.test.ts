import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('self-service trial AI experience', () => {
  it('loads org-scoped trial quota without exposing the claim table to the browser', () => {
    const source = readProjectFile('app/api/saas/trial/ai-quota/route.ts');

    expect(source).toContain('await getOrgContext({');
    expect(source).toContain("roles: ['owner', 'admin', 'staff']");
    expect(source).toContain('loadSelfServiceTrialAIQuotaSnapshot({');
    expect(source).toContain('context.featureFlags.google_trial_signup');
    expect(source).not.toContain('analysis_reservation_token');
  });

  it('shows a non-billable static demo and confirms before the single real run', () => {
    const source = readProjectFile('app/(admin)/analytics/ai-report/page.tsx');

    expect(source).toContain("fetch('/api/saas/trial/ai-quota'");
    expect(source).toContain('buildStaticDemoReport(selectedPeriod)');
    expect(source).toContain('示範資料，不會扣額度');
    expect(source).toContain('使用本次試用唯一的 AI 分析額度？');
    expect(source).toContain('trialQuota.remaining <= 0');
  });
});
