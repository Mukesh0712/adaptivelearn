import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../models/User.js';

type ExpiresIn = NonNullable<SignOptions['expiresIn']>;

// What we put inside the access token. Keep it small: the token is sent on
// every request, and anyone holding it can read (but not change) its contents.
export interface AccessTokenPayload {
  sub: string; // user id ("subject" is the standard JWT claim name)
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as ExpiresIn,
  });
}

// Throws if the signature is wrong or the token has expired.
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub, role: decoded.role as Role };
}

// Refresh tokens use a DIFFERENT secret, so an access token can never be
// passed off as a refresh token (or vice versa). The random jti makes every
// issued token unique, even two issued in the same second.
export function signRefreshToken(userId: string): { token: string; expiresAt: Date } {
  const token = jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as ExpiresIn,
    jwtid: crypto.randomUUID(),
  });
  const { exp } = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(exp * 1000) };
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === 'string' || !decoded.sub) {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub };
}

// We store only a hash of the refresh token, so a leaked database can't be
// used to log in. SHA-256 (not bcrypt) is right here: the token is already
// long and random, and bcrypt would silently ignore everything past 72 bytes.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
