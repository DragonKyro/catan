import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/catan/',
  // Online rooms record the build that made them, so devices on another
  // build get a warning (see networkStore).
  define: {
    __APP_BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
  plugins: [
    react(),
    // Older phones: Safari's engine only updates with iOS, and some iPhones
    // stop at iOS 12-15. Modern chunks are lowered to their syntax and get
    // polyfills for the newer built-ins the code uses; browsers without ES
    // modules load a separate legacy bundle. Up-to-date browsers download
    // the same modern build as before (plus a small polyfills chunk).
    legacy({
      targets: ['defaults', 'iOS >= 12', 'Safari >= 12', 'Chrome >= 64', 'Android >= 7'],
      modernTargets: ['iOS >= 12', 'Safari >= 12', 'Chrome >= 64', 'ChromeAndroid >= 64', 'Edge >= 79', 'Firefox >= 67'],
      modernPolyfills: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
