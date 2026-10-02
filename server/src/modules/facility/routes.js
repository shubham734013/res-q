/**
 * ResQ — facility routes.
 * Mounted at /api/v1
 */

import { Router } from 'express';
import {
  FacilityDetailQuery,
  FacilityIdParam,
  NearbyQuery,
  SAFETY_COPY,
} from '../../contracts/index.js';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error.js';
import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import {
  getFacilityAvailability,
  getFacilityDetail,
  getMeta,
  searchNearby,
} from './service.js';
import { FACILITY_INCLUDE, serializeFacilityListItem } from './serializer.js';

export const facilityRouter = Router();

/** Reference data for the filter panel. */
facilityRouter.get(
  '/facilities/meta',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getMeta() });
  }),
);

facilityRouter.get(
  '/facilities/nearby',
  validateQuery(NearbyQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery;
    const result = await searchNearby(q);

    res.json({
      success: true,
      data: {
        items: result.items,
        pagination: result.pagination,
        appliedFilters: {
          lat: q.lat,
          lng: q.lng,
          radiusKm: q.radiusKm,
          sort: q.sort,
          type: q.type ?? null,
          department: q.department ?? null,
          service: q.service ?? null,
          emergency: q.emergency ?? null,
          verified: q.verified ?? null,
          openNow: q.openNow ?? null,
        },
        containsDemoData: result.containsDemoData,
      },
    });
  }),
);

facilityRouter.get(
  '/facilities/:id',
  validateParams(FacilityIdParam),
  validateQuery(FacilityDetailQuery),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.validatedQuery;
    const origin = lat != null && lng != null ? { lat, lng } : null;
    const facility = await getFacilityDetail(req.validatedParams.id, origin);
    res.json({ success: true, data: { facility } });
  }),
);

facilityRouter.get(
  '/facilities/:id/availability',
  validateParams(FacilityIdParam),
  asyncHandler(async (req, res) => {
    const availability = await getFacilityAvailability(req.validatedParams.id);
    res.json({
      success: true,
      data: {
        facilityId: req.validatedParams.id,
        availability,
        disclaimer: SAFETY_COPY.availability,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// Saved facilities
// ---------------------------------------------------------------------------

facilityRouter.get(
  '/saved/facilities',
  requireAuth,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const rows = await prisma.savedFacility.findMany({
      where: { userId: req.user.id },
      include: { facility: { include: FACILITY_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });

    // Saved facilities are listed without a distance: the user is not
    // necessarily anywhere near them, and a stale distance is worse than none.
    const items = rows
      .filter((r) => r.facility.deletedAt == null)
      .map((r) => {
        const item = serializeFacilityListItem(r.facility, {
          lat: Number(r.facility.latitude),
          lng: Number(r.facility.longitude),
        });
        delete item.distanceMeters;
        return item;
      });

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: 1,
          limit: items.length,
          total: items.length,
          totalPages: 1,
          hasNext: false,
        },
      },
    });
  }),
);

facilityRouter.post(
  '/saved/facilities/:id',
  requireAuth,
  validateParams(FacilityIdParam),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const facilityId = req.validatedParams.id;

    const exists = await prisma.facility.findFirst({
      where: { id: facilityId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw ApiError.facilityNotFound();

    const saved = await prisma.savedFacility.upsert({
      where: { userId_facilityId: { userId: req.user.id, facilityId } },
      create: { userId: req.user.id, facilityId },
      update: {},
    });

    res.status(201).json({
      success: true,
      data: { facilityId, savedAt: saved.createdAt.toISOString() },
    });
  }),
);

facilityRouter.delete(
  '/saved/facilities/:id',
  requireAuth,
  validateParams(FacilityIdParam),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    await prisma.savedFacility.deleteMany({
      where: { userId: req.user.id, facilityId: req.validatedParams.id },
    });
    // deleteMany rather than delete: un-saving something already un-saved is
    // not an error, and a 404 here would make the UI's toggle fragile.
    res.json({ success: true, data: { facilityId: req.validatedParams.id } });
  }),
);
