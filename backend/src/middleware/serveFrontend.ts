import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';

// In production, this one Express server also serves the built React app
// (frontend/dist). The browser then loads the pages and calls /api from the
// SAME address, so the login cookie is a normal first-party cookie and no
// CORS is involved.
//
// This file sits at backend/src/middleware (dev) or backend/dist/middleware
// (compiled): three levels below the repo root either way.
const FRONTEND_DIST = path.resolve(import.meta.dirname, '../../../frontend/dist');

export function serveFrontend(app: Express): void {
  const indexHtml = path.join(FRONTEND_DIST, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn(`Frontend build not found at ${FRONTEND_DIST}; serving the API only.`);
    return;
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
    res.sendFile(indexHtml);
  });
}
