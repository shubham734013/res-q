/**
 * ResQ — facility serializers.
 *
 * Every facility and availability payload leaves the API through this file.
 * That is deliberate: it is the single choke point where provenance is attached
 * and where a positive availability claim without a timestamp is collapsed to
 * UNKNOWN. A new endpoint that bypasses these functions bypasses the safety
 * rules, so route handlers must call them rather than shaping objects inline.
 */

import { buildProvenance, guardStatus } from '../../lib/freshness.js';
import { haversineMeters, toNumber } from '../../lib/distance.js';
import { evaluateOpenState } from '../../lib/openState.js';

/** Counts are only trustworthy from these sources (master prompt §13). */
const COUNT_TRUSTED_SOURCES = new Set(['OFFICIAL', 'VERIFIED_PROVIDER']);

export function serializeAvailability(row, now = new Date()) {
  const provenance = buildProvenance({
    sourceName: row.dataSource?.name ?? sourceLabel(row.sourceType),
    sourceType: row.sourceType,
    lastUpdatedAt: row.lastUpdatedAt,
    now,
  });

  const status = guardStatus(row.status, provenance);

  return {
    resourceType: row.resourceType,
    status,
    // Suppressed unless the source is authoritative AND the status still
    // stands after the guard above.
    count:
      COUNT_TRUSTED_SOURCES.has(row.sourceType) && status !== 'UNKNOWN' && row.count != null
        ? row.count
        : null,
    note: row.note ?? null,
    ...provenance,
  };
}

function sourceLabel(sourceType) {
  switch (sourceType) {
    case 'OFFICIAL':
      return 'Official source';
    case 'VERIFIED_PROVIDER':
      return 'Verified hospital update';
    case 'THIRD_PARTY':
      return 'Third-party directory';
    case 'COMMUNITY_REPORTED':
      return 'Community reported';
    case 'DEMO':
      return 'Demo data';
    default:
      return null;
  }
}

/**
 * List-shaped facility. `origin` is the caller's point; when absent the caller
 * must not be shown a distance, so this requires it.
 */
export function serializeFacilityListItem(facility, origin, now = new Date()) {
  const lat = toNumber(facility.latitude);
  const lng = toNumber(facility.longitude);

  const availability = (facility.availability ?? []).map((a) => serializeAvailability(a, now));

  return {
    id: facility.id,
    name: facility.name,
    type: facility.type,
    address: facility.address,
    city: facility.city,
    latitude: lat,
    longitude: lng,
    phone: facility.phone ?? null,
    emergencyPhone: facility.emergencyPhone ?? null,
    distanceMeters: haversineMeters(origin.lat, origin.lng, lat, lng),
    hasEmergency: facility.hasEmergency,
    verificationStatus: facility.verificationStatus,
    openState: evaluateOpenState(facility.operatingHours, now),
    departments: (facility.departments ?? []).map((d) => d.department.slug),
    availability,
    provenance: buildProvenance({
      sourceName: facility.dataSource?.name ?? sourceLabel(facility.sourceType),
      sourceType: facility.sourceType,
      lastUpdatedAt: facility.lastUpdatedAt,
      now,
    }),
  };
}

export function serializeFacilityDetail(facility, origin, now = new Date()) {
  const lat = toNumber(facility.latitude);
  const lng = toNumber(facility.longitude);

  // Latest verification record, if any. The reviewer's identity is NOT exposed.
  const verification = facility.verifications?.[0] ?? null;

  return {
    id: facility.id,
    name: facility.name,
    type: facility.type,
    description: facility.description ?? null,
    address: facility.address,
    city: facility.city,
    state: facility.state ?? null,
    postalCode: facility.postalCode ?? null,
    latitude: lat,
    longitude: lng,
    phone: facility.phone ?? null,
    emergencyPhone: facility.emergencyPhone ?? null,
    website: facility.website ?? null,
    logoUrl: facility.logoUrl ?? null,

    distanceMeters: origin ? haversineMeters(origin.lat, origin.lng, lat, lng) : null,

    hasEmergency: facility.hasEmergency,
    verificationStatus: facility.verificationStatus,
    openState: evaluateOpenState(facility.operatingHours, now),

    departments: (facility.departments ?? []).map((d) => ({
      id: d.department.id,
      name: d.department.name,
      slug: d.department.slug,
      description: d.department.description ?? null,
    })),
    services: (facility.services ?? []).map((s) => ({
      id: s.service.id,
      name: s.service.name,
      slug: s.service.slug,
      description: s.service.description ?? null,
    })),
    operatingHours: (facility.operatingHours ?? []).map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime ?? null,
      closeTime: h.closeTime ?? null,
      isClosed: h.isClosed,
      is24Hours: h.is24Hours,
    })),

    verification: {
      status: facility.verificationStatus,
      verifiedAt: verification?.reviewedAt ? verification.reviewedAt.toISOString() : null,
      verificationSource: verification ? sourceLabel(verification.sourceType) : null,
      expiresAt: verification?.expiresAt ? verification.expiresAt.toISOString() : null,
    },

    availability: (facility.availability ?? []).map((a) => serializeAvailability(a, now)),

    provenance: buildProvenance({
      sourceName: facility.dataSource?.name ?? sourceLabel(facility.sourceType),
      sourceType: facility.sourceType,
      lastUpdatedAt: facility.lastUpdatedAt,
      now,
    }),

    isDemoData: facility.sourceType === 'DEMO',
  };
}

/** The include tree every facility read uses. Kept in one place so a route
 *  cannot forget to load operatingHours and then silently report UNKNOWN. */
export const FACILITY_INCLUDE = {
  dataSource: true,
  operatingHours: true,
  availability: { include: { dataSource: true } },
  departments: { include: { department: true } },
};

export const FACILITY_DETAIL_INCLUDE = {
  ...FACILITY_INCLUDE,
  services: { include: { service: true } },
  verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
};
