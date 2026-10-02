/**
 * ResQ — authentication and authorization middleware.
 */

import { ApiError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { getPrisma } from '../lib/prisma.js';

function readBearer(req) {
  const header = req.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Hard requirement. 401 if there is no valid token. */
export function requireAuth(req, _res, next) {
  try {
    const token = readBearer(req);
    if (!token) throw ApiError.unauthorized();
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches req.user when a valid token is present, and otherwise continues
 * anonymously. Used by Emergency Mode and by anonymous reporting — those must
 * work signed-out.
 */
export function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {
    // An expired or malformed token on an optional route is treated as absent
    // rather than fatal, so a stale tab cannot lock someone out of Emergency Mode.
  }
  next();
}

/** Role gate. Always used after requireAuth. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your account does not have access to this action.'));
    }
    next();
  };

/**
 * Ownership check for hospital-admin routes.
 *
 * Resolves the facility the caller may act on and puts it on req.facilityId.
 * SUPER_ADMIN may act on any facility. A HOSPITAL_ADMIN may act only on a
 * facility they have a FacilityAdmin row for — asking for someone else's
 * facility is a 403, not a 404, because the resource exists and the caller
 * simply may not touch it.
 *
 * This runs server-side on every write. Hiding the button in the UI is not a
 * control; this is.
 */
export async function resolveFacilityOwnership(req, _res, next) {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const requested =
      req.body?.facilityId ?? req.validatedQuery?.facilityId ?? req.query?.facilityId ?? null;

    const prisma = await getPrisma();

    if (req.user.role === 'SUPER_ADMIN') {
      if (!requested) {
        throw ApiError.validation('facilityId is required for an administrator.');
      }
      req.facilityId = requested;
      req.managedFacilityIds = [requested];
      return next();
    }

    const rows = await prisma.facilityAdmin.findMany({
      where: { userId: req.user.id },
      select: { facilityId: true },
    });
    const managed = rows.map((r) => r.facilityId);

    if (managed.length === 0) {
      throw ApiError.forbidden('This account is not linked to any facility.');
    }

    if (requested && !managed.includes(requested)) {
      throw ApiError.forbidden('You do not manage this facility.');
    }

    req.facilityId = requested ?? managed[0];
    req.managedFacilityIds = managed;
    next();
  } catch (err) {
    next(err);
  }
}
