import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('internal organization usage guidance', () => {
  it('explains what each usage metric counts and what happens at the limit', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/internal/orgs/[id]/page.tsx'),
      'utf8'
    );

    expect(source).toContain('團隊席次');
    expect(source).toContain('達上限後將無法再新增成員');
    expect(source).toContain('本月退貨量');
    expect(source).toContain('達上限後將無法再新增退貨');
    expect(source).toContain('本月 AI 分析');
    expect(source).toContain('達上限後本月將暫停 AI 分析');
  });
});
