import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('server action logging boundary', () => {
  it('does not log Server Action arguments that can contain credentials', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'next.config.ts'), 'utf8');

    expect(source).toMatch(/serverFunctions:\s*false/);
  });
});
