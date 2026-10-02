/**
 * ResQ — Emergency Mode contracts.
 * POST  /api/v1/emergency/sessions
 * PATCH /api/v1/emergency/sessions/:id
 * GET   /api/v1/emergency/contacts  (+ POST / PATCH / DELETE)
 * POST  /api/v1/emergency/share
 */

import { z } from 'zod';
import {
  EmergencySessionStatus,
  IsoDateTime,
  Latitude,
  Longitude,
  PhoneNumber,
  RADIUS_KM_DEFAULT,
  RadiusKm,
  Uuid,
  successResponse,
} from './common.js';
import { FacilityListItem } from './facility.js';

// ---------------------------------------------------------------------------
// POST /emergency/sessions
// ---------------------------------------------------------------------------

/**
 * Works signed-out: an unauthenticated caller gets a session with userId null.
 * Requiring a login to use Emergency Mode would be the worst design decision
 * available to this product.
 */
export const CreateEmergencySessionRequest = z.object({
  latitude: Latitude,
  longitude: Longitude,
  radiusKm: RadiusKm.default(RADIUS_KM_DEFAULT),
  /** Set when the user typed a location instead of granting geolocation. */
  locationIsManual: z.boolean().default(false),
});

export const EmergencySession = z.object({
  id: Uuid,
  status: EmergencySessionStatus,
  latitude: Latitude,
  longitude: Longitude,
  selectedFacilityId: Uuid.nullable(),
  startedAt: IsoDateTime,
  endedAt: IsoDateTime.nullable(),
  /** Location is discarded at this time. Surfaced so the UI can say so. */
  expiresAt: IsoDateTime,
});

/**
 * Ranked shortlist. Emergency ordering per TDD §11.3: emergency capability,
 * then freshness, then verification, then distance. `rankReason` is returned so
 * the ordering is explainable in the UI and in tests — an opaque score on a
 * healthcare product is not acceptable.
 */
export const EmergencyFacility = FacilityListItem.extend({
  rank: z.number().int().positive(),
  rankReason: z.array(z.string()),
});

export const CreateEmergencySessionResponse = successResponse(
  z.object({
    session: EmergencySession,
    facilities: z.array(EmergencyFacility),
    /**
     * Degradation flags — TDD §15.3. Emergency Mode must render even when
     * dependencies fail, and must say which ones did.
     */
    degraded: z.object({
      mapUnavailable: z.boolean(),
      usingManualLocation: z.boolean(),
      availabilityStale: z.boolean(),
    }),
    /** Always present, always rendered. Never suppressed by a client flag. */
    safetyNotice: z.string(),
    containsDemoData: z.boolean(),
  }),
);

// ---------------------------------------------------------------------------
// PATCH /emergency/sessions/:id
// ---------------------------------------------------------------------------

export const EmergencySessionIdParam = z.object({ id: Uuid });

/**
 * Selecting a facility records intent only. It is NOT a booking, and no
 * response from this endpoint may state or imply that a facility has accepted
 * the patient (master prompt §17, §56).
 */
export const UpdateEmergencySessionRequest = z
  .object({
    status: z.enum(['FACILITY_SELECTED', 'COMPLETED', 'ABANDONED']),
    selectedFacilityId: Uuid.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const UpdateEmergencySessionResponse = successResponse(
  z.object({ session: EmergencySession }),
);

// ---------------------------------------------------------------------------
// Emergency contacts
// ---------------------------------------------------------------------------

export const EmergencyContact = z.object({
  id: Uuid,
  name: z.string(),
  phone: PhoneNumber,
  relationship: z.string().nullable(),
  priority: z.number().int().min(1).max(10),
  createdAt: IsoDateTime,
});

export const EmergencyContactsResponse = successResponse(
  z.object({ contacts: z.array(EmergencyContact) }),
);

export const CreateEmergencyContactRequest = z.object({
  name: z.string().min(1).max(120).trim(),
  phone: PhoneNumber,
  relationship: z.string().max(60).optional(),
  priority: z.number().int().min(1).max(10).default(1),
});

export const UpdateEmergencyContactRequest = CreateEmergencyContactRequest.partial().refine(
  (v) => Object.keys(v).length > 0,
  'At least one field must be provided',
);

export const EmergencyContactIdParam = z.object({ id: Uuid });

export const EmergencyContactResponse = successResponse(
  z.object({ contact: EmergencyContact }),
);

export const DeleteEmergencyContactResponse = successResponse(z.object({ id: Uuid }));

// ---------------------------------------------------------------------------
// Location sharing
// ---------------------------------------------------------------------------

/**
 * One-shot share, triggered by an explicit user action. There is no continuous
 * tracking endpoint and none should be added without a separate consent flow
 * (master prompt §18, §45).
 */
export const ShareLocationRequest = z.object({
  sessionId: Uuid,
  contactIds: z.array(Uuid).min(1).max(10),
  includeSelectedFacility: z.boolean().default(true),
});

export const ShareLocationResponse = successResponse(
  z.object({
    /**
     * Queued, not delivered. Never claim delivery — TDD §15.3 is explicit that
     * a notification failure must not be reported as a success.
     */
    queued: z.array(z.object({ contactId: Uuid, channel: z.enum(['SMS', 'EMAIL']) })),
    failed: z.array(z.object({ contactId: Uuid, reason: z.string() })),
    deliveryDisclaimer: z.string(),
  }),
);
