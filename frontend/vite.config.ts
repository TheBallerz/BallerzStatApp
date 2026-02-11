import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Development-only server settings
  server: {
    proxy: {
      // Forward frontend `/api/*` requests to the backend
      '/api': 'http://localhost:3000',
    },
  },
});
