import type { RequestHandler } from 'express';
import { isProduction } from '../config/env.js';

// In production, any request that arrived over plain HTTP is permanently
// redirected to the same URL on HTTPS. Combined with the HSTS header that
// helmet sends, browsers then refuse to use HTTP for this site at all.
//
// Behind a hosting proxy (Render, Railway, Nginx...), TLS ends at the proxy,
// so req.secure relies on `app.set('trust proxy', ...)` reading the
// X-Forwarded-Proto header. Skipped in development (localhost is plain HTTP).
export const enforceHttps: RequestHandler = (req, res, next) => {
  if (!isProduction || req.secure) {
    next();
    return;
  }
  res.redirect(308, `https://${req.headers.host ?? ''}${req.originalUrl}`);
};
