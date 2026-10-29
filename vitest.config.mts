import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    // Playwright specs run with `npm run test:e2e`.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
