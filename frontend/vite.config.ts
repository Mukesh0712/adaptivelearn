import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5174,
    // Forward /api/* to the Express backend. The browser only ever talks to
    // localhost:5174, so the refresh-token cookie is "same-site" and no CORS
    // setup is needed in development.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
