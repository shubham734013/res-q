/**
 * ResQ — facility contracts.
 * GET /api/v1/facilities/nearby
 * GET /api/v1/facilities/:id
 * GET /api/v1/facilities/:id/availability
 * GET/POST/DELETE /api/v1/saved/facilities
 */

import { z } from 'zod';
import {
  AvailabilityStatus,
  FacilityType,
  IsoDateTime,
  Latitude,
  Longitude,
  PaginationQuery,
  PhoneNumber,
  Provenance,
  RADIUS_KM_DEFAULT,
  RadiusKm,
  ResourceType,
  TimeOfDay,
  Uuid,
  VerificationStatus,
  paginated,
  successResponse,
  withProvenanceInvariants,
} from './common.js';

// ---------------------------------------------------------------------------
// GET /facilities/nearby
// ---------------------------------------------------------------------------

export const NearbySort = z.enum(['DISTANCE', 'RELEVANCE', 'AVAILABILITY', 'VERIFICATION']);

/**
 * Query params arrive as strings, hence z.coerce for numbers.
 *
 * Booleans are matched against the literal "true"/"false" rather than coerced:
 * z.coerce.boolean() turns the string "false" into `true`, because
 * Boolean("false") is true. That would silently invert every filter here.
 */
const QueryBoolean = z.enum(['true', 'false']).transform((v) => v === 'true');

/**
 * Numeric query param.
 *
 * z.coerce.number() alone turns a MISSING value into NaN, so an absent `lat`
 * reports "expected number, received nan" instead of "Required". Preprocessing
 * undefined/"" back to undefined keeps the required-field message useful.
 */
const numericParam = (schema) =>
  z.preprocess((v) => (v === undefined || v === null || v === '' ? undefined : Number(v)), schema);

export const NearbyQuery = PaginationQuery.extend({
  lat: numericParam(Latitude),
  lng: numericParam(Longitude),
  radiusKm: numericParam(RadiusKm).default(RADIUS_KM_DEFAULT),

  /** Free-text name match. */
  q: z.string().max(120).trim().optional(),

  type: FacilityType.optional(),
  /** Department and service are matched by slug, not display name. */
  department: z.string().max(60).optional(),
  service: z.string().max(60).optional(),

  emergency: QueryBoolean.optional(),
  verified: QueryBoolean.optional(),
  openNow: QueryBoolean.optional(),

  sort: NearbySort.default('DISTANCE'),
});

/** Availability summary on a result — status plus the provenance that backs it. */
export const AvailabilitySummary = withProvenanceInvariants(
  z
    .object({
      resourceType: ResourceType,
      status: AvailabilityStatus,
      /** Only populated when sourceType is OFFICIAL or VERIFIED_PROVIDER. */
      count: z.number().int().nonnegative().nullable(),
      note: z.string().nullable(),
    })
    .merge(Provenance),
);

export const OpenState = z.enum(['OPEN', 'CLOSED', 'UNKNOWN']);

export const FacilityListItem = z.object({
  id: Uuid,
  name: z.string(),
  type: FacilityType,
  address: z.string(),
  city: z.string(),
  latitude: Latitude,
  longitude: Longitude,
  phone: PhoneNumber.nullable(),
  emergencyPhone: PhoneNumber.nullable(),

  /** Metres from the caller's point. Rounded — do not imply survey precision. */
  distanceMeters: z.number().nonnegative(),

  hasEmergency: z.boolean(),
  verificationStatus: VerificationStatus,
  openState: OpenState,

  /** Department slugs, for the chips on the result card. */
  departments: z.array(z.string()),

  /** Emergency-relevant rows only; the full set is on the detail endpoint. */
  availability: z.array(AvailabilitySummary),

  /** Provenance of the facility RECORD itself, distinct from availability. */
  provenance: Provenance,
});

export const NearbyResponse = successResponse(
  paginated(FacilityListItem).extend({
    appliedFilters: z.object({
      lat: Latitude,
      lng: Longitude,
      radiusKm: z.number(),
      sort: NearbySort,
      type: FacilityType.nullable(),
      department: z.string().nullable(),
      service: z.string().nullable(),
      emergency: z.boolean().nullable(),
      verified: z.boolean().nullable(),
      openNow: z.boolean().nullable(),
    }),
    /**
     * True when any item on this page came from seeded data, so the UI can
     * raise the DEMO DATA banner without inspecting every row.
     */
    containsDemoData: z.boolean(),
  }),
);

// ---------------------------------------------------------------------------
// GET /facilities/:id
// ---------------------------------------------------------------------------

export const FacilityIdParam = z.object({ id: Uuid });

/** Optional lat/lng so the detail page can show distance without a 2nd call. */
export const FacilityDetailQuery = z.object({
  lat: numericParam(Latitude).optional(),
  lng: numericParam(Longitude).optional(),
});

export const OperatingHourItem = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: TimeOfDay.nullable(),
  closeTime: TimeOfDay.nullable(),
  isClosed: z.boolean(),
  is24Hours: z.boolean(),
});

export const NamedRef = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
});

export const VerificationSummary = z.object({
  status: VerificationStatus,
  verifiedAt: IsoDateTime.nullable(),
  /** Source name only. Never the reviewer's identity — that stays in AuditLog. */
  verificationSource: z.string().nullable(),
  expiresAt: IsoDateTime.nullable(),
});

export const FacilityDetail = FacilityListItem.omit({
  distanceMeters: true,
  departments: true,
}).extend({
  description: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  website: z.string().url().nullable(),
  logoUrl: z.string().url().nullable(),

  /** null when the caller supplied no coordinates. */
  distanceMeters: z.number().nonnegative().nullable(),

  departments: z.array(NamedRef),
  services: z.array(NamedRef),
  operatingHours: z.array(OperatingHourItem),
  verification: VerificationSummary,

  /** Full set, one row per resource type the facility reports. */
  availability: z.array(AvailabilitySummary),

  isDemoData: z.boolean(),
});

export const FacilityDetailResponse = successResponse(z.object({ facility: FacilityDetail }));

// ---------------------------------------------------------------------------
// GET /facilities/:id/availability
// ---------------------------------------------------------------------------

export const FacilityAvailabilityResponse = successResponse(
  z.object({
    facilityId: Uuid,
    availability: z.array(AvailabilitySummary),
    /** Rendered verbatim by the client; worded once, server-side. */
    disclaimer: z.string(),
  }),
);

// ---------------------------------------------------------------------------
// Saved facilities
// ---------------------------------------------------------------------------

export const SavedFacilitiesResponse = successResponse(
  paginated(FacilityListItem.omit({ distanceMeters: true })),
);

export const SaveFacilityResponse = successResponse(
  z.object({ facilityId: Uuid, savedAt: IsoDateTime }),
);

export const UnsaveFacilityResponse = successResponse(z.object({ facilityId: Uuid }));

// ---------------------------------------------------------------------------
// Reference data — GET /facilities/meta (departments + services for filters)
// ---------------------------------------------------------------------------

export const FacilityMetaResponse = successResponse(
  z.object({ departments: z.array(NamedRef), services: z.array(NamedRef) }),
);
