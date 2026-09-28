import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { env } from '../config/env.js';

// In production, this one Express server also serves the built React app
// (frontend/dist). The browser then loads the pages and calls /api from the
// SAME address, so the login cookie is a normal first-party cookie and no
// CORS is involved.
//
// This file sits at backend/src/middleware (dev) or backend/dist/middleware
// (compiled): three levels below the repo root either way.
const FRONTEND_DIST = path.resolve(import.meta.dirname, '../../../frontend/dist');

// Files that may contain the __SITE_URL__ placeholder (social-preview tags,
// robots.txt, sitemap.xml). They are filled in with this server's public
// address once at startup, so they are correct even if the address wasn't
// known when the frontend was built.
const TEMPLATED: Record<string, string> = {
  '/robots.txt': 'text/plain; charset=utf-8',
  '/sitemap.xml': 'application/xml; charset=utf-8',
};

// Images and the manifest must be loadable by other websites (social
// networks and link-preview tools show og-image.jpg on THEIR pages).
// helmet's default Cross-Origin-Resource-Policy "same-origin" would block
// that, so it is relaxed for these public files only.
const SHAREABLE = /\.(png|jpe?g|svg|ico|webp|webmanifest)$/i;

export function serveFrontend(app: Express): void {
  const indexPath = path.join(FRONTEND_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`Frontend build not found at ${FRONTEND_DIST}; serving the API only.`);
    return;
  }

  const siteUrl = env.CLIENT_ORIGIN.replace(/\/$/, '');
  const fill = (file: string) =>
    fs.readFileSync(path.join(FRONTEND_DIST, file), 'utf8').replaceAll('__SITE_URL__', siteUrl);

  const indexHtml = fill('index.html');
  for (const [route, type] of Object.entries(TEMPLATED)) {
    const file = route.slice(1);
    if (!fs.existsSync(path.join(FRONTEND_DIST, file))) continue;
    const body = fill(file);
    app.get(route, (_req, res) => {
      res.type(type).setHeader('Cache-Control', 'no-cache');
      res.send(body);
    });
  }

  // Files in /assets have a content hash in their name (e.g. index-a1b2c3.js),
  // so browsers may cache them for a year. Everything else is revalidated.
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      setHeaders(res, filePath) {
        const cache = filePath.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';
        res.setHeader('Cache-Control', cache);
        if (SHAREABLE.test(filePath)) res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  // Single-page app: any other GET/HEAD that isn't an API call gets index.html,
  // and React Router shows the right page (or the 404 page).
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(indexHtml);
  });
}
