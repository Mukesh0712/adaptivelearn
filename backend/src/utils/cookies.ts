import type { CookieOptions, Response } from 'express';
import { isProduction } from '../config/env.js';

export const REFRESH_COOKIE = 'refreshToken';

const baseOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read it → safe from XSS theft
  secure: isProduction, // HTTPS-only in production (localhost is plain HTTP)
  sameSite: 'lax', // not sent on cross-site POSTs → CSRF protection
  path: '/api/auth', // only sent to auth endpoints, not with every API call
};

// With `expires` the cookie survives a browser restart ("Remember me").
// Without it, it's a session cookie that the browser deletes when closed.
export function setRefreshCookie(res: Response, token: string, expires?: Date) {
  res.cookie(REFRESH_COOKIE, token, expires ? { ...baseOptions, expires } : baseOptions);
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}
