import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { seoPlugin } from './seo.plugin.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // Public address of the site (e.g. https://adaptivelearn.example.com).
  // Set VITE_SITE_URL when building for production.
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5174'

  return {
    plugins: [react(), tailwindcss(), seoPlugin(siteUrl)],
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
    preview: {
      port: 4174,
      proxy: { '/api': 'http://localhost:5000' },
    },
  }
})
