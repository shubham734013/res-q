/**
 * ResQ — hospital admin contracts.
 * GET   /api/v1/hospital-admin/facility
 * PATCH /api/v1/hospital-admin/facility
 * PATCH /api/v1/hospital-admin/availability
 *
 * OWNERSHIP: the single-facility routes do not take a facilityId from the
 * client. The server resolves the caller's facility from FacilityAdmin using
 * the JWT subject. Where a facilityId IS accepted (an admin managing more than
 * one facility), the handler must verify the FacilityAdmin row server-side and
 * return 403 otherwise — hiding the button is not a control.
 */

import { z } from 'zod';
import {
  AvailabilityStatus,
  IsoDateTime,
  PhoneNumber,
  ResourceType,
  TimeOfDay,
  Uuid,
  successResponse,
} from './common.js';
import { FacilityDetail } from './facility.js';

// ---------------------------------------------------------------------------
// GET /hospital-admin/facility
// ---------------------------------------------------------------------------

/** Optional: needed only for an admin who manages several facilities. */
export const HospitalAdminFacilityQuery = z.object({ facilityId: Uuid.optional() });

export const HospitalAdminFacilityResponse = successResponse(
  z.object({
    facility: FacilityDetail,
    /** Every facility this caller may act on. Drives the switcher in the UI. */
    managedFacilityIds: z.array(Uuid),
  }),
);

// ---------------------------------------------------------------------------
// PATCH /hospital-admin/facility
// ---------------------------------------------------------------------------

export const OperatingHourInput = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: TimeOfDay.nullable(),
    closeTime: TimeOfDay.nullable(),
    isClosed: z.boolean().default(false),
    is24Hours: z.boolean().default(false),
  })
  .refine((v) => !(v.isClosed && v.is24Hours), {
    path: ['is24Hours'],
    message: 'A day cannot be both closed and open 24 hours',
  })
  .refine((v) => v.isClosed || v.is24Hours || (v.openTime != null && v.closeTime != null), {
    path: ['openTime'],
    message: 'Open and close times are required unless closed or 24h',
  });

/**
 * Deliberately narrow. A hospital admin may correct contact details and hours.
 * They may NOT change the facility's name, type, coordinates or verification
 * status — those are identity and trust fields, and only SUPER_ADMIN touches
 * them. Leaving them out of the schema is the enforcement.
 */
export const UpdateFacilityRequest = z
  .object({
    facilityId: Uuid.optional(),
    description: z.string().max(2000).nullable(),
    phone: PhoneNumber.nullable(),
    emergencyPhone: PhoneNumber.nullable(),
    website: z.string().url().nullable(),
    logoUrl: z.string().url().nullable(),
    address: z.string().min(5).max(300),
    hasEmergency: z.boolean(),
    departmentSlugs: z.array(z.string().max(60)).max(60),
    serviceSlugs: z.array(z.string().max(60)).max(60),
    operatingHours: z.array(OperatingHourInput).max(7),
  })
  .partial()
  .refine(
    (v) => Object.keys(v).filter((k) => k !== 'facilityId').length > 0,
    'At least one field must be provided',
  );

export const UpdateFacilityResponse = successResponse(z.object({ facility: FacilityDetail }));

// ---------------------------------------------------------------------------
// PATCH /hospital-admin/availability
// ---------------------------------------------------------------------------

/**
 * A count may be supplied but is advisory. The serializer suppresses it unless
 * the facility's sourceType is OFFICIAL or VERIFIED_PROVIDER, so an unverified
 * hospital cannot publish "4 ICU beds" as though it were authoritative.
 */
export const AvailabilityUpdateItem = z
  .object({
    resourceType: ResourceType,
    status: AvailabilityStatus,
    count: z.number().int().nonnegative().max(10000).nullable().optional(),
    note: z.string().max(280).nullable().optional(),
  })
  .refine((v) => !(v.status === 'UNKNOWN' && v.count != null), {
    path: ['count'],
    message: 'A count cannot accompany an UNKNOWN status',
  })
  .refine((v) => !(v.status === 'FULL' && v.count != null && v.count > 0), {
    path: ['count'],
    message: 'A FULL resource cannot report a positive count',
  });

export const UpdateAvailabilityRequest = z.object({
  facilityId: Uuid.optional(),
  updates: z.array(AvailabilityUpdateItem).min(1).max(10),
});

export const UpdateAvailabilityResponse = successResponse(
  z.object({
    facilityId: Uuid,
    updated: z.array(
      z.object({
        resourceType: ResourceType,
        status: AvailabilityStatus,
        /**
         * Server-assigned, not client-supplied. A client-supplied timestamp
         * would let a facility backdate or future-date its own freshness.
         */
        lastUpdatedAt: IsoDateTime,
      }),
    ),
    auditLogId: Uuid,
  }),
);
