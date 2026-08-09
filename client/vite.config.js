import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/orgs': 'http://localhost:3001',
      '/query': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/events': 'http://localhost:3001',
    },
  },
});
