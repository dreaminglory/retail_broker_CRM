import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    // Playwright specs run with `npm run test:e2e`.
    // `.claude/worktrees` holds other sessions' checkouts of this repo.
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    // Printed by `npm run test:services`, not gated (AD-043).
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/domain/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
