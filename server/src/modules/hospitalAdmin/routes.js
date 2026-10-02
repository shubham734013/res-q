/**
 * ResQ — hospital admin routes.
 * Mounted at /api/v1/hospital-admin
 *
 * Every route here runs resolveFacilityOwnership, which checks the caller's
 * FacilityAdmin rows server-side. See the 403 test in test/ownership.test.js.
 */

import { Router } from 'express';
import {
  HospitalAdminFacilityQuery,
  UpdateAvailabilityRequest,
  UpdateFacilityRequest,
} from '../../contracts/index.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { requireAuth, requireRole, resolveFacilityOwnership } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error.js';
import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import {
  FACILITY_DETAIL_INCLUDE,
  serializeFacilityDetail,
} from '../facility/serializer.js';

export const hospitalAdminRouter = Router();

hospitalAdminRouter.use(requireAuth, requireRole('HOSPITAL_ADMIN', 'SUPER_ADMIN'));

async function loadDetail(prisma, facilityId) {
  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, deletedAt: null },
    include: FACILITY_DETAIL_INCLUDE,
  });
  if (!facility) throw ApiError.facilityNotFound();
  return serializeFacilityDetail(facility, null);
}

hospitalAdminRouter.get(
  '/facility',
  validateQuery(HospitalAdminFacilityQuery),
  resolveFacilityOwnership,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    res.json({
      success: true,
      data: {
        facility: await loadDetail(prisma, req.facilityId),
        managedFacilityIds: req.managedFacilityIds,
      },
    });
  }),
);

hospitalAdminRouter.patch(
  '/facility',
  validateBody(UpdateFacilityRequest),
  resolveFacilityOwnership,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const facilityId = req.facilityId;
    const { departmentSlugs, serviceSlugs, operatingHours, facilityId: _ignored, ...scalars } =
      req.body;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(scalars).length > 0) {
        await tx.facility.update({
          where: { id: facilityId },
          // lastUpdatedAt is set server-side; a client cannot backdate its own
          // freshness.
          data: { ...scalars, lastUpdatedAt: new Date() },
        });
      }

      if (departmentSlugs) {
        const departments = await tx.department.findMany({
          where: { slug: { in: departmentSlugs } },
          select: { id: true },
        });
        await tx.facilityDepartment.deleteMany({ where: { facilityId } });
        await tx.facilityDepartment.createMany({
          data: departments.map((d) => ({ facilityId, departmentId: d.id })),
          skipDuplicates: true,
        });
      }

      if (serviceSlugs) {
        const services = await tx.service.findMany({
          where: { slug: { in: serviceSlugs } },
          select: { id: true },
        });
        await tx.facilityService.deleteMany({ where: { facilityId } });
        await tx.facilityService.createMany({
          data: services.map((s) => ({ facilityId, serviceId: s.id })),
          skipDuplicates: true,
        });
      }

      if (operatingHours) {
        await tx.operatingHour.deleteMany({ where: { facilityId } });
        await tx.operatingHour.createMany({
          data: operatingHours.map((h) => ({ ...h, facilityId })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'FACILITY_UPDATED',
          entityType: 'Facility',
          entityId: facilityId,
          metadata: { fields: Object.keys(req.body) },
          requestId: req.id,
        },
      });
    });

    res.json({ success: true, data: { facility: await loadDetail(prisma, facilityId) } });
  }),
);

hospitalAdminRouter.patch(
  '/availability',
  validateBody(UpdateAvailabilityRequest),
  resolveFacilityOwnership,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const facilityId = req.facilityId;
    const now = new Date();

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, deletedAt: null },
      select: { id: true, sourceType: true },
    });
    if (!facility) throw ApiError.facilityNotFound();

    // A hospital updating its own availability is a VERIFIED_PROVIDER claim,
    // not an OFFICIAL one — unless the whole deployment is running demo data,
    // in which case it must stay labelled DEMO.
    const sourceType = facility.sourceType === 'DEMO' ? 'DEMO' : 'VERIFIED_PROVIDER';

    const result = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const item of req.body.updates) {
        const row = await tx.facilityAvailability.upsert({
          where: {
            facilityId_resourceType: { facilityId, resourceType: item.resourceType },
          },
          create: {
            facilityId,
            resourceType: item.resourceType,
            status: item.status,
            count: item.count ?? null,
            note: item.note ?? null,
            sourceType,
            updatedById: req.user.id,
            lastUpdatedAt: now,
          },
          update: {
            status: item.status,
            count: item.count ?? null,
            note: item.note ?? null,
            sourceType,
            updatedById: req.user.id,
            lastUpdatedAt: now,
          },
        });
        updated.push({
          resourceType: row.resourceType,
          status: row.status,
          lastUpdatedAt: row.lastUpdatedAt.toISOString(),
        });
      }

      // Availability history lives in AuditLog — the availability table itself
      // holds only the current row per resource.
      const audit = await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'AVAILABILITY_UPDATED',
          entityType: 'Facility',
          entityId: facilityId,
          metadata: { updates: req.body.updates },
          requestId: req.id,
        },
      });

      return { updated, auditLogId: audit.id };
    });

    res.json({ success: true, data: { facilityId, ...result } });
  }),
);
