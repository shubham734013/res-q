/**
 * ResQ — auth contracts.
 * POST /api/v1/auth/register | login | refresh | logout
 * GET  /api/v1/me   PATCH /api/v1/me
 */

import { z } from 'zod';
import { IsoDateTime, PhoneNumber, UserRole, UserStatus, Uuid, successResponse } from './common.js';

/**
 * 12 characters minimum, no composition rules. NIST SP 800-63B: length beats
 * character-class requirements, which mostly produce "Password1!".
 */
export const Password = z.string().min(12, 'Password must be at least 12 characters').max(128);

export const Email = z.string().email().max(254).toLowerCase().trim();

// ---------------------------------------------------------------------------
// Public user shape. passwordHash must never appear here — enforced by this
// schema being the only thing a serializer is permitted to return.
// ---------------------------------------------------------------------------

export const PublicUser = z.object({
  id: Uuid,
  name: z.string(),
  email: Email,
  phone: PhoneNumber.nullable(),
  role: UserRole,
  status: UserStatus,
  profileImage: z.string().url().nullable(),
  preferredCity: z.string().nullable(),
  createdAt: IsoDateTime,
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

/**
 * `role` is deliberately absent. Everyone registers as USER; elevation to
 * HOSPITAL_ADMIN or SUPER_ADMIN happens only through an admin action.
 * Accepting a client-supplied role here is the classic privilege-escalation
 * hole, so the field does not exist rather than being stripped later.
 */
export const RegisterRequest = z.object({
  name: z.string().min(2).max(120).trim(),
  email: Email,
  phone: PhoneNumber.optional(),
  password: Password,
});

export const AuthTokens = z.object({
  accessToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  /**
   * Present only for non-browser clients. In the browser the refresh token is
   * set as an HttpOnly, Secure, SameSite cookie and never reaches JS.
   */
  refreshToken: z.string().optional(),
});

export const AuthPayload = z.object({ user: PublicUser, tokens: AuthTokens });
export const RegisterResponse = successResponse(AuthPayload);

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

export const LoginRequest = z.object({ email: Email, password: z.string().min(1) });
export const LoginResponse = successResponse(AuthPayload);

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

/** Body is empty for browser clients — the cookie carries the token. */
export const RefreshRequest = z.object({ refreshToken: z.string().optional() });
export const RefreshResponse = successResponse(z.object({ tokens: AuthTokens }));

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

export const LogoutRequest = z.object({
  /** true revokes every refresh token for the user, not just this device. */
  allDevices: z.boolean().default(false),
});

export const LogoutResponse = successResponse(z.object({ revoked: z.number().int() }));

// ---------------------------------------------------------------------------
// GET /me, PATCH /me
// ---------------------------------------------------------------------------

export const MeResponse = successResponse(z.object({ user: PublicUser }));

export const UpdateMeRequest = z
  .object({
    name: z.string().min(2).max(120).trim(),
    phone: PhoneNumber.nullable(),
    profileImage: z.string().url().nullable(),
    preferredCity: z.string().max(120).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const UpdateMeResponse = successResponse(z.object({ user: PublicUser }));
