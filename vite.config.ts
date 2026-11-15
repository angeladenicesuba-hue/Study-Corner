import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __APP_BUILD_NUMBER__: JSON.stringify(Number(process.env.GITHUB_RUN_NUMBER || 0)),
    __APP_BUILD_COMMIT__: JSON.stringify((process.env.GITHUB_SHA || 'local').slice(0, 7)),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
