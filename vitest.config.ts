import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` / `client-only` throw when imported outside their runtime;
      // alias them to an empty stub so server-only modules are unit-testable.
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
      'client-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    clearMocks: true,
    mockReset: true,
  },
});
