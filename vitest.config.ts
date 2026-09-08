import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
      'apps/*/tests/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'packages/engine/*/tests/**/*.test.ts',
      'packages/server/*/tests/**/*.test.ts',
      'tools/*/tests/**/*.test.ts'
    ]
  }
});
