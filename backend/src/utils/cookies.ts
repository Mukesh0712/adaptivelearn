import type { CookieOptions, Response } from 'express';
import { isProduction } from '../config/env.js';

export const REFRESH_COOKIE = 'refreshToken';

const baseOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read it → safe from XSS theft
  secure: isProduction, // HTTPS-only in production (localhost is plain HTTP)
  sameSite: 'lax', // not sent on cross-site POSTs → CSRF protection
  path: '/api/auth', // only sent to auth endpoints, not with every API call
};

export function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions, expires });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}
