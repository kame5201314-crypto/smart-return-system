import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('workspace deep write UI', () => {
  it.each([
    'app/(admin)/returns/[id]/page.tsx',
    'app/(admin)/returns/inspection/[id]/page.tsx',
    'app/(admin)/shopee-returns/[id]/page.tsx',
    'app/(admin)/shopee-returns/scan/page.tsx',
    'app/(admin)/shopee-returns/scan/unmatched/page.tsx',
    'app/(admin)/pickup/scan/page.tsx',
  ])('enforces workspace access on %s', (path) => {
    const source = readProjectFile(path);

    expect(source).toContain('useWorkspaceAccess');
    expect(source).toContain('canCreateData');
    expect(source).toContain('!canCreateData');
  });

  it('removes the scan route link while the workspace is read-only', () => {
    const source = readProjectFile('app/(admin)/shopee-returns/page.tsx');

    expect(source).toContain('canCreateData ? (');
    expect(source).toContain('href="/shopee-returns/scan"');
    expect(source).toContain('title={WORKSPACE_RESTRICTED_ACTION_TITLE}');
  });
});
