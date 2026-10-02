/**
 * ResQ — facility search and detail.
 *
 * Search strategy (TDD §10.3, no PostGIS):
 *   1. bounding-box prefilter on the indexed latitude/longitude columns
 *   2. exact Haversine on the candidate set
 *   3. radius cut, then rank, then paginate
 *
 * Steps 2–4 run in the application layer. For prototype volumes this is both
 * simpler and faster than pushing trigonometry into SQL through $queryRaw, and
 * it keeps the whole thing swappable for PostGIS behind lib/distance.js.
 */

import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { boundingBox } from '../../lib/distance.js';
import { rankFacilities, SORTERS } from '../../lib/ranking.js';
import {
  FACILITY_DETAIL_INCLUDE,
  FACILITY_INCLUDE,
  serializeAvailability,
  serializeFacilityDetail,
  serializeFacilityListItem,
} from './serializer.js';

/**
 * Hard ceiling on bounding-box candidates. Without it, a 50 km radius over a
 * dense city would pull the whole table into memory to sort it. If this cap is
 * ever hit in practice, that is the signal to move ranking into SQL or adopt
 * PostGIS — not to raise the number.
 */
const MAX_CANDIDATES = 2000;

export async function searchNearby(query, { emergencyMode = false } = {}) {
  const prisma = await getPrisma();
  const now = new Date();
  const box = boundingBox(query.lat, query.lng, query.radiusKm);

  const where = {
    deletedAt: null,
    latitude: { gte: box.minLat, lte: box.maxLat },
    longitude: { gte: box.minLng, lte: box.maxLng },
    ...(query.type && { type: query.type }),
    ...(query.emergency === true && { hasEmergency: true }),
    ...(emergencyMode && { hasEmergency: true }),
    ...(query.verified === true && { verificationStatus: 'VERIFIED' }),
    ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
    ...(query.department && {
      departments: { some: { isActive: true, department: { slug: query.department } } },
    }),
    ...(query.service && {
      services: { some: { isActive: true, service: { slug: query.service } } },
    }),
  };

  const candidates = await prisma.facility.findMany({
    where,
    include: FACILITY_INCLUDE,
    take: MAX_CANDIDATES,
  });

  const origin = { lat: query.lat, lng: query.lng };
  const radiusMeters = query.radiusKm * 1000;

  let items = candidates
    .map((f) => serializeFacilityListItem(f, origin, now))
    // The box is a superset of the circle; this removes the corners.
    .filter((f) => f.distanceMeters <= radiusMeters);

  if (query.openNow === true) {
    // UNKNOWN is kept. Excluding facilities whose hours we simply do not have
    // would hide real options behind a gap in our data.
    items = items.filter((f) => f.openState !== 'CLOSED');
  }

  const sorter = SORTERS[query.sort];
  if (emergencyMode || query.sort === 'RELEVANCE') {
    items = rankFacilities(items, {
      emergency: emergencyMode,
      requestedService: query.department ?? null,
    });
  } else if (sorter) {
    items = [...items].sort(sorter);
  }

  const total = items.length;
  const start = (query.page - 1) * query.limit;
  const pageItems = items.slice(start, start + query.limit);

  return {
    items: pageItems,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
      hasNext: start + query.limit < total,
    },
    containsDemoData: pageItems.some((f) => f.provenance.sourceType === 'DEMO'),
    truncated: candidates.length >= MAX_CANDIDATES,
  };
}

export async function getFacilityDetail(id, origin) {
  const prisma = await getPrisma();
  const facility = await prisma.facility.findFirst({
    where: { id, deletedAt: null },
    include: FACILITY_DETAIL_INCLUDE,
  });
  if (!facility) throw ApiError.facilityNotFound();
  return serializeFacilityDetail(facility, origin);
}

export async function getFacilityAvailability(id) {
  const prisma = await getPrisma();
  const facility = await prisma.facility.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!facility) throw ApiError.facilityNotFound();

  const rows = await prisma.facilityAvailability.findMany({
    where: { facilityId: id },
    include: { dataSource: true },
    orderBy: { resourceType: 'asc' },
  });

  return rows.map((r) => serializeAvailability(r));
}

export async function getMeta() {
  const prisma = await getPrisma();
  const [departments, services] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.service.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const shape = (r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
  });
  return { departments: departments.map(shape), services: services.map(shape) };
}
