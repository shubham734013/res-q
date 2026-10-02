/**
 * ResQ — shared primitives for every API contract.
 *
 * JavaScript (ESM). Zod still validates at runtime exactly as it did under
 * TypeScript — only the compile-time types are gone. Every invariant in this
 * file is enforced when the code runs, not when it is compiled.
 *
 * This file is copied verbatim into client/src/contracts/common.js. It has no
 * dependency beyond zod so the copy stays trivial.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums — kept byte-identical to schema.prisma. Change one there, change it
// here in the same commit.
// ---------------------------------------------------------------------------

export const UserRole = z.enum(['USER', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']);

export const UserStatus = z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']);

export const FacilityType = z.enum([
  'GOVERNMENT_HOSPITAL',
  'PRIVATE_HOSPITAL',
  'TRAUMA_CENTER',
  'EMERGENCY_CENTER',
  'CLINIC',
  'DIAGNOSTIC_CENTER',
  'BLOOD_BANK',
  'PHARMACY',
  'AMBULANCE_PROVIDER',
]);

export const VerificationStatus = z.enum([
  'UNVERIFIED',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
  'SUSPENDED',
]);

export const SourceType = z.enum([
  'OFFICIAL',
  'VERIFIED_PROVIDER',
  'THIRD_PARTY',
  'COMMUNITY_REPORTED',
  'DEMO',
  'UNKNOWN',
]);

export const ResourceType = z.enum([
  'EMERGENCY_DEPARTMENT',
  'GENERAL_BED',
  'ICU_BED',
  'VENTILATOR',
  'AMBULANCE',
  'OXYGEN',
]);

export const AvailabilityStatus = z.enum([
  'AVAILABLE',
  'LIMITED',
  'UNAVAILABLE',
  'FULL',
  'UNKNOWN',
]);

export const FreshnessStatus = z.enum(['REAL_TIME', 'RECENT', 'STALE', 'DEMO', 'UNKNOWN']);

export const ReportCategory = z.enum([
  'INCORRECT_PHONE',
  'INCORRECT_ADDRESS',
  'INCORRECT_HOURS',
  'INCORRECT_DEPARTMENT',
  'INCORRECT_SERVICE',
  'INCORRECT_AVAILABILITY',
  'INCORRECT_BLOOD_INFO',
  'DUPLICATE_FACILITY',
  'FACILITY_CLOSED',
  'OTHER',
]);

export const ReportStatus = z.enum([
  'OPEN',
  'TRIAGED',
  'INVESTIGATING',
  'RESOLVED',
  'DISMISSED',
]);

export const EmergencySessionStatus = z.enum([
  'ACTIVE',
  'FACILITY_SELECTED',
  'COMPLETED',
  'ABANDONED',
]);

/** Plain arrays of the enum values, handy for rendering filter dropdowns. */
export const FACILITY_TYPES = FacilityType.options;
export const RESOURCE_TYPES = ResourceType.options;
export const REPORT_CATEGORIES = ReportCategory.options;

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

export const Uuid = z.string().uuid();

/** ISO-8601 with timezone. Every timestamp crossing the wire is a UTC string. */
export const IsoDateTime = z.string().datetime({ offset: true });

export const Latitude = z.number().min(-90).max(90);
export const Longitude = z.number().min(-180).max(180);

/** TDD §10.4 — default 10 km, and the backend enforces a ceiling. */
export const RADIUS_KM_DEFAULT = 10;
export const RADIUS_KM_MAX = 50;
export const RadiusKm = z.number().positive().max(RADIUS_KM_MAX);

/** "HH:MM", 24-hour, zero-padded — matches OperatingHour in schema.prisma. */
export const TimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:MM');

/**
 * Phone numbers are stored as the source gave them. Validate shape loosely —
 * rejecting a real hospital's number over a formatting rule is a worse failure
 * than storing an odd-looking one.
 */
export const PhoneNumber = z.string().min(5).max(32);

// ---------------------------------------------------------------------------
// Response envelope — TDD §8.2
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'FACILITY_NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
  'RADIUS_TOO_LARGE',
  'LOCATION_REQUIRED',
  'INTERNAL_ERROR',
];

export const ErrorCode = z.enum(ERROR_CODES);

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  /** Field-level detail for VALIDATION_ERROR. Never carries internal errors. */
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const ErrorResponse = z.object({
  success: z.literal(false),
  error: ApiError,
  requestId: z.string(),
});

export const successResponse = (data) => z.object({ success: z.literal(true), data });

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const PaginationMeta = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
});

export const paginated = (item) =>
  z.object({ items: z.array(item), pagination: PaginationMeta });

// ---------------------------------------------------------------------------
// Provenance — the block that must accompany EVERY sourced claim
// ---------------------------------------------------------------------------

/**
 * TDD §12.2. No endpoint may return a status without this block attached.
 * `source` is the human-readable source name ("Verified Hospital Update");
 * `sourceType` is the machine-readable classification that drives the badge.
 */
export const Provenance = z.object({
  source: z.string().nullable(),
  sourceType: SourceType,
  lastUpdatedAt: IsoDateTime.nullable(),
  freshnessStatus: FreshnessStatus,
});

/**
 * The safety invariant, expressed as a runtime check so a violating payload
 * fails a contract test instead of reaching a user:
 *
 *   - no lastUpdatedAt  =>  freshnessStatus must be UNKNOWN
 *   - no lastUpdatedAt  =>  status must be UNKNOWN, never a positive claim
 *   - sourceType DEMO   =>  freshnessStatus must be DEMO
 *
 * Wrap any object carrying both a provenance block and an availability-style
 * `status` field with this.
 */
export const withProvenanceInvariants = (schema) =>
  schema.superRefine((value, ctx) => {
    if (value.lastUpdatedAt == null && value.freshnessStatus !== 'UNKNOWN') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['freshnessStatus'],
        message: 'freshnessStatus must be UNKNOWN when lastUpdatedAt is null',
      });
    }

    if (value.lastUpdatedAt == null && value.status != null && value.status !== 'UNKNOWN') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message:
          'status must be UNKNOWN when lastUpdatedAt is null — never report availability without a timestamp',
      });
    }

    // Only once a timestamp exists: a demo row with no timestamp is UNKNOWN,
    // and the rule above already covers it.
    if (
      value.sourceType === 'DEMO' &&
      value.lastUpdatedAt != null &&
      value.freshnessStatus !== 'DEMO'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['freshnessStatus'],
        message: 'Demo data must be labelled DEMO, not presented as live',
      });
    }
  });

// ---------------------------------------------------------------------------
// Safety copy. Held server-side so the wording of a disclaimer cannot fork
// across client builds (master prompt §56).
// ---------------------------------------------------------------------------

export const SAFETY_COPY = {
  availability:
    'Availability information may change. Please call the facility to confirm before travelling when possible.',
  emergency:
    'If this is a life-threatening emergency, contact your local emergency service immediately.',
  notification:
    'A message has been queued. Delivery is not guaranteed — confirm by phone if you can.',
  demoData:
    'This deployment is showing demo data. It does not reflect real facilities or real availability.',
};
