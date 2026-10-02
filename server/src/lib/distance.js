/**
 * ResQ — geographic distance (TDD §10.3, Haversine fallback path).
 *
 * No PostGIS. The strategy is a bounding-box prefilter on the indexed
 * latitude/longitude columns, then exact Haversine on the (small) candidate
 * set. Everything distance-related lives behind this module so a PostGIS
 * implementation can replace it later without touching any caller.
 */

const EARTH_RADIUS_M = 6371008.8; // IUGG mean radius
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres.
 * @returns {number} metres, rounded to the nearest metre
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))));
}

/**
 * Bounding box for a radius around a point, used as a cheap indexed prefilter.
 *
 * Longitude degrees shrink with latitude, so the longitude delta is divided by
 * cos(lat). Near the poles that blows up, so it is clamped to a full sweep.
 * The box is always a superset of the true circle — Haversine then removes the
 * corners, so an over-wide box costs performance, never correctness.
 */
export function boundingBox(lat, lng, radiusKm) {
  const radiusDegLat = radiusKm / 111.32;
  const cos = Math.cos(toRad(lat));

  const radiusDegLng =
    Math.abs(cos) < 1e-6 ? 180 : Math.min(180, radiusKm / (111.32 * Math.abs(cos)));

  return {
    minLat: Math.max(-90, lat - radiusDegLat),
    maxLat: Math.min(90, lat + radiusDegLat),
    minLng: Math.max(-180, lng - radiusDegLng),
    maxLng: Math.min(180, lng + radiusDegLng),
  };
}

/**
 * Prisma returns Decimal columns as Decimal objects, not numbers. Going via
 * Number() on the raw value keeps precision and avoids the string-concat bug
 * you get if a Decimal ever reaches arithmetic unconverted.
 */
export function toNumber(value) {
  if (value == null) return null;
  return typeof value === 'number' ? value : Number(value.toString());
}

/** Formats metres for display: "850 m", "2.4 km". */
export function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
