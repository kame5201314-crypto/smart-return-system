import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('expired workspace action UI', () => {
  it('injects subscription action access into all merchant admin pages', () => {
    const template = readProjectFile('app/(admin)/template.tsx');

    expect(template).toContain('buildWorkspaceActionAccess(context.orgStatus)');
    expect(template).toContain("previewMode.state === 'ready' ? enforceWorkspaceReadOnly(baseAccess)");
    expect(template).toContain('<WorkspaceAccessProvider access={access}>');
  });

  it('disables create, import, and export actions on return workspaces', () => {
    for (const path of [
      'app/(admin)/returns/page.tsx',
      'app/(admin)/shopee-returns/page.tsx',
      'app/(admin)/pickup/page.tsx',
    ]) {
      const source = readProjectFile(path);

      expect(source).toContain('useWorkspaceAccess()');
      expect(source).toContain('!canCreateData');
      expect(source).toContain('canExport');
      expect(source).toMatch(/disabled=\{!canExport\}|canExport \? \(/);
      expect(source).toContain('WORKSPACE_RESTRICTED_ACTION_TITLE');
    }
  });

  it('disables the real AI analysis CTA while retaining upgrade and support links', () => {
    const source = readProjectFile('app/(admin)/analytics/ai-report/page.tsx');

    expect(source).toContain('const { canUseAI } = useWorkspaceAccess()');
    expect(source).toContain('trialAnalysisBlocked || !canUseAI');
    expect(source).toContain('升級方案');
    expect(source).toContain('聯絡客服');
  });

  it('explains that expired workspaces remain readable and names every paused action', () => {
    const notice = readProjectFile('lib/saas/workspace-access-notice.ts');
    const banner = readProjectFile('components/saas/workspace-access-banner.tsx');

    expect(notice).toContain('目前仍可查看歷史資料');
    expect(notice).toContain('新增退貨、資料匯入／匯出與 AI 分析已停用');
    expect(banner).toContain('升級方案');
    expect(banner).toContain('聯絡客服');
  });
});
