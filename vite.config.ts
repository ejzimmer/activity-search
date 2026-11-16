import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), '').ACTIVITIES_API_URL;
  return {
    plugins: [react()],
    server: apiUrl
      ? {
          proxy: {
            '/api': {
              target: apiUrl,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          },
        }
      : undefined,
  };
});
