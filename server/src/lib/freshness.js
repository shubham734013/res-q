/**
 * ResQ — freshness derivation (TDD §12.3).
 *
 * freshnessStatus is computed on every read and never stored. A stored
 * freshness column would itself go stale, which is precisely the failure this
 * whole subsystem exists to prevent.
 */

/** Minutes. Tune per resource type if real integrations ever land. */
export const FRESHNESS_THRESHOLDS = {
  /** Only reachable for a source that genuinely pushes live data. */
  realTimeMinutes: 5,
  /** Beyond this the UI must say "may be outdated". */
  recentMinutes: 60,
};

/**
 * Source types permitted to claim REAL_TIME. Nothing in the prototype
 * qualifies, so REAL_TIME is unreachable until a live integration is added —
 * which is correct behaviour, not a gap.
 */
const REAL_TIME_CAPABLE = new Set(['OFFICIAL']);

/**
 * @param {{ lastUpdatedAt: Date|null|undefined, sourceType: string,
 *           isLiveFeed?: boolean, now?: Date }} input
 * @returns {'REAL_TIME'|'RECENT'|'STALE'|'DEMO'|'UNKNOWN'}
 */
export function deriveFreshness(input) {
  const { lastUpdatedAt, sourceType, isLiveFeed = false, now = new Date() } = input;

  // No timestamp beats everything, including the DEMO label. A row nobody has
  // ever written a time for is UNKNOWN, not "demo data as of some unknown
  // moment" — and the provenance invariant requires UNKNOWN here, so returning
  // DEMO would emit a payload that fails our own contract.
  if (!lastUpdatedAt) return 'UNKNOWN';

  // Otherwise demo data is labelled demo no matter how recently it was seeded.
  if (sourceType === 'DEMO') return 'DEMO';

  const ageMinutes = (now.getTime() - lastUpdatedAt.getTime()) / 60000;

  // A future timestamp means a broken clock or a bad import. Do not trust it.
  if (ageMinutes < 0) return 'UNKNOWN';

  if (
    isLiveFeed &&
    REAL_TIME_CAPABLE.has(sourceType) &&
    ageMinutes <= FRESHNESS_THRESHOLDS.realTimeMinutes
  ) {
    return 'REAL_TIME';
  }

  if (ageMinutes <= FRESHNESS_THRESHOLDS.recentMinutes) return 'RECENT';

  return 'STALE';
}

/**
 * Build the provenance block.
 *
 * Every serializer must go through this. It is the single choke point where the
 * "never fabricate availability" rule is enforced, so a new endpoint cannot
 * quietly bypass it.
 *
 * @param {{ sourceName: string|null, sourceType: string,
 *           lastUpdatedAt: Date|null|undefined, isLiveFeed?: boolean, now?: Date }} args
 */
export function buildProvenance(args) {
  const freshnessStatus = deriveFreshness(args);
  return {
    source: args.sourceName,
    sourceType: args.sourceType,
    lastUpdatedAt: args.lastUpdatedAt ? args.lastUpdatedAt.toISOString() : null,
    freshnessStatus,
  };
}

/** Collapses any positive claim to UNKNOWN when provenance cannot support it. */
export function guardStatus(status, provenance) {
  return provenance.lastUpdatedAt == null ? 'UNKNOWN' : status;
}

/** Human label for the UI. Kept here so wording stays consistent everywhere. */
export function freshnessLabel(provenance, now = new Date()) {
  if (provenance.freshnessStatus === 'DEMO') return 'Demo data';
  if (!provenance.lastUpdatedAt) return 'No recent information';

  const ageMinutes = Math.floor(
    (now.getTime() - new Date(provenance.lastUpdatedAt).getTime()) / 60000,
  );
  if (ageMinutes < 1) return 'Updated just now';
  if (ageMinutes < 60) return `Updated ${ageMinutes} min ago`;

  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
