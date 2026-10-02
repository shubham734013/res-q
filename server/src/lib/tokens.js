/**
 * ResQ — token issue, verification and refresh rotation (TDD §13.3).
 *
 * The refresh token is stored only as a SHA-256 hash. A database leak therefore
 * does not hand an attacker usable sessions, and rotation makes a stolen token
 * single-use: replaying a rotated token is detected and kills the whole chain.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { ApiError } from './errors.js';

export const REFRESH_COOKIE = 'resq_refresh';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: 'resq',
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'resq' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError('TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token.');
  }
}

/** Opaque random string. Not a JWT — nothing about it should be self-asserting. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function refreshExpiry(now = new Date()) {
  return new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}
