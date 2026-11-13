import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  ssr: {
    external: ['node:sqlite'],
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'web/**/*.test.ts'],
    server: {
      deps: {
        external: [/^node:sqlite$/],
      },
    },
  },
});
