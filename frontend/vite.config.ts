import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    resolve: {
      alias: {
        'expo-secure-store': path.resolve(rootDir, 'src/lib/expo-secure-store-stub.ts'),
        'expo-modules-core': path.resolve(rootDir, 'src/lib/expo-modules-core-stub.ts'),
        'expo-constants': path.resolve(rootDir, 'src/lib/expo-constants-stub.ts'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/morbeez-staff/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 5173,
    },
    build: {
      rollupOptions: {
        external: ['react-native'],
      },
    },
  };
});
