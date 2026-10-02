/**
 * ResQ — authentication routes.
 * Mounted at /api/v1/auth, plus /api/v1/me
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest,
  UpdateMeRequest,
} from '../../contracts/index.js';
import { validateBody } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error.js';
import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { env } from '../../lib/env.js';
import {
  REFRESH_COOKIE,
  generateRefreshToken,
  hashToken,
  refreshCookieOptions,
  refreshExpiry,
  signAccessToken,
} from '../../lib/tokens.js';

const BCRYPT_ROUNDS = 12;

/**
 * Tighter limit on the credential endpoints than on the API at large.
 * Keyed by IP; a real deployment should also key on the submitted email to
 * blunt credential stuffing across many addresses.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again shortly.' },
      requestId: req.id,
    }),
});

export const authRouter = Router();
export const meRouter = Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage ?? null,
    preferredCity: user.preferredCity ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function issueSession(prisma, user, req, res) {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(),
      userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
    },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

  return {
    accessToken: signAccessToken(user),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

authRouter.post(
  '/register',
  authLimiter,
  validateBody(RegisterRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const { name, email, phone, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw ApiError.conflict('An account with that email already exists.');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        // role is NOT read from the request — see RegisterRequest.
        role: 'USER',
      },
    });

    const tokens = await issueSession(prisma, user, req, res);
    res.status(201).json({ success: true, data: { user: publicUser(user), tokens } });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(LoginRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });

    // Same error and roughly the same work whether or not the account exists,
    // so this endpoint cannot be used to enumerate registered emails.
    const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(req.body.password, hash);

    if (!user || !ok) {
      throw new ApiError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    if (user.status === 'SUSPENDED') {
      throw ApiError.forbidden('This account has been suspended.');
    }

    const tokens = await issueSession(prisma, user, req, res);
    res.json({ success: true, data: { user: publicUser(user), tokens } });
  }),
);

authRouter.post(
  '/refresh',
  validateBody(RefreshRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const presented = req.cookies?.[REFRESH_COOKIE] ?? req.body.refreshToken;
    if (!presented) throw ApiError.unauthorized('No refresh token presented.');

    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presented) },
      include: { user: true },
    });

    if (!record) throw new ApiError('TOKEN_REVOKED', 'Session is no longer valid.');

    // A token that was already rotated being presented again means it leaked.
    // Revoke the entire family rather than just refusing this one request.
    if (record.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ApiError('TOKEN_REVOKED', 'Session is no longer valid. Please sign in again.');
    }

    if (record.expiresAt < new Date()) {
      throw new ApiError('TOKEN_EXPIRED', 'Session has expired. Please sign in again.');
    }

    const next = generateRefreshToken();
    const created = await prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: hashToken(next),
        expiresAt: refreshExpiry(),
        userAgent: req.get('user-agent')?.slice(0, 255) ?? null,
      },
    });
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByTokenId: created.id },
    });

    res.cookie(REFRESH_COOKIE, next, refreshCookieOptions());
    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: signAccessToken(record.user),
          expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
        },
      },
    });
  }),
);

authRouter.post(
  '/logout',
  validateBody(LogoutRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const presented = req.cookies?.[REFRESH_COOKIE] ?? req.body.refreshToken;
    let revoked = 0;

    if (presented) {
      const record = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(presented) },
        select: { id: true, userId: true },
      });
      if (record) {
        const result = req.body.allDevices
          ? await prisma.refreshToken.updateMany({
              where: { userId: record.userId, revokedAt: null },
              data: { revokedAt: new Date() },
            })
          : await prisma.refreshToken.updateMany({
              where: { id: record.id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
        revoked = result.count;
      }
    }

    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    res.json({ success: true, data: { revoked } });
  }),
);

// ---------------------------------------------------------------------------
// /me
// ---------------------------------------------------------------------------

meRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw ApiError.unauthorized();
    res.json({ success: true, data: { user: publicUser(user) } });
  }),
);

meRouter.patch(
  '/',
  requireAuth,
  validateBody(UpdateMeRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const user = await prisma.user.update({ where: { id: req.user.id }, data: req.body });
    res.json({ success: true, data: { user: publicUser(user) } });
  }),
);
