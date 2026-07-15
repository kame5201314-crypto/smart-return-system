/* @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('full test script', () => {
  it('includes the UI regression suite used by CI and predeploy', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['test:all']).toContain('npm run test:ui');
  });
});
