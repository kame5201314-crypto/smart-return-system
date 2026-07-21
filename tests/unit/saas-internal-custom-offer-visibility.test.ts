import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('internal organization detail visibility', () => {
  it('keeps private custom offer controls hidden from the operations UI', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/internal/orgs/[id]/page.tsx'),
      'utf8'
    );

    expect(source).not.toContain('CustomPlanOfferControls');
    expect(source).not.toContain('custom-plan-offer-controls');
  });

  it('hides member and advanced feature diagnostics from the operations UI', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/internal/orgs/[id]/page.tsx'),
      'utf8'
    );

    expect(source).not.toContain('成員資訊');
    expect(source).not.toContain('進階功能資訊');
    expect(source).not.toContain('data.members');
    expect(source).not.toContain('org.featureFlags');
    expect(source).toContain('帳務資料');
    expect(source).toContain('操作紀錄');
  });
});
