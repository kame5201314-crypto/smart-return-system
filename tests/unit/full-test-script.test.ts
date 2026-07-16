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

  it('keeps a bounded production dependency audit in the SaaS safety workflow', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    const workflow = readFileSync(
      join(process.cwd(), '.github', 'workflows', 'saas-safety.yml'),
      'utf8'
    );

    expect(packageJson.scripts?.['audit:prod:high'])
      .toBe('npm audit --omit=dev --audit-level=high');
    expect(workflow).toContain('npm run audit:prod:high');
    expect(workflow).not.toContain('npm audit fix');
  });
});
