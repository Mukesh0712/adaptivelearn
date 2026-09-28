import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { seoPlugin } from './seo.plugin.ts'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd())
  // Public address of the site (e.g. https://adaptivelearn.example.com), used
  // for social previews, robots.txt and sitemap.xml. If it isn't known at
  // build time, the placeholder __SITE_URL__ is kept and the Express server
  // fills in its real address when it serves those files.
  const siteUrl =
    env.VITE_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (command === 'serve' ? 'http://localhost:5174' : '__SITE_URL__')

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
