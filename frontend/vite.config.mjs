import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = process.env.BACKEND_PORT || '30054';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.REACT_APP_API_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true } } },
});
