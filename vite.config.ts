import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    base: '/',
    plugins: [react()],
    define: {
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@domain': path.resolve(__dirname, 'src/domain'),
        '@data': path.resolve(__dirname, 'src/data'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@platform': path.resolve(__dirname, 'src/platform'),
        '@ui': path.resolve(__dirname, 'src/ui'),
      }
    }
  };
});
