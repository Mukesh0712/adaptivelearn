import type { Plugin } from 'vite'

// Public pages that search engines may index. Portals are private.
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/privacy', '/terms']
const PRIVATE_PATHS = ['/student', '/instructor', '/parent', '/admin', '/reset-password', '/accept-invite']

// Build-time SEO helper:
//  - replaces __SITE_URL__ in index.html with the real site address
//    (VITE_SITE_URL), because social previews need absolute URLs
//  - generates robots.txt and sitemap.xml for that address
export function seoPlugin(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/$/, '')

  const robots = [
    'User-agent: *',
    ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')

  const today = new Date().toISOString().slice(0, 10)
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_PATHS.map((p) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n')

  return {
    name: 'adaptivelearn-seo',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', base),
    // Dev server: serve the same files so they can be checked locally.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt') res.setHeader('Content-Type', 'text/plain').end(robots)
        else if (req.url === '/sitemap.xml') res.setHeader('Content-Type', 'application/xml').end(sitemap)
        else next()
      })
    },
    // Production build: write them into dist/.
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
  }
}
