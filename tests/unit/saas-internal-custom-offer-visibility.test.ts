import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('internal organization detail visibility', () => {
  it('shows tenant-scoped offer controls only through the protected organization detail UI', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/internal/orgs/[id]/page.tsx'),
      'utf8'
    );

    expect(source).toContain("import { CustomPlanOfferControls }");
    expect(source).toContain('custom-plan-offer-controls');
    expect(source).toContain('<CustomPlanOfferControls');
    expect(source).toContain("permissions.includes('manage_billing_operations')");
  });

  it('keeps tenant follow-up details actionable without exposing return records', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/internal/orgs/[id]/page.tsx'),
      'utf8'
    );

    expect(source).not.toContain('成員資訊');
    expect(source).not.toContain('進階功能資訊');
    expect(source).toContain('成員與權限（');
    expect(source).toContain('sortedMembers');
    expect(source).toContain('org.featureFlags');
    expect(source).toContain('<EmailLink email={readyOrg.ownerEmail}');
    expect(source).toContain('<CopyEmailButton email={email}');
    expect(source).toContain('帳務資料');
    expect(source).toContain('操作紀錄');
    expect(source).toContain('功能開關');
    expect(source).toContain('下一個需關注');
    expect(source).toContain('formatRelativeTime(log.createdAt)');
    expect(source).not.toContain('試用已到期，建議聯絡客戶確認續約或延長試用。</p>');
  });
});
