/**
 * ResQ — search ranking (TDD §11.3, master prompt §55).
 *
 * The ranking is deliberately transparent: every factor is a named, bounded
 * contribution, and each result carries back the reasons that moved it. An
 * opaque score on a healthcare product is not acceptable, and "document the
 * ranking algorithm" is a requirement, not a nicety.
 *
 * Nothing here can be bought. There is no sponsorship input and there must
 * never be one (master prompt §55).
 */

/** Normal browsing: distance dominates, trust and freshness adjust. */
export const NORMAL_WEIGHTS = {
  distance: 1.0,
  emergencyCapable: 0.15,
  verified: 0.2,
  freshness: 0.15,
  serviceMatch: 0.3,
  openNow: 0.1,
};

/**
 * Emergency Mode: capability and trustworthy, current information outrank
 * proximity. A nearer hospital with no emergency department is the wrong
 * answer, and so is one whose status nobody has touched in three days.
 */
export const EMERGENCY_WEIGHTS = {
  distance: 0.5,
  emergencyCapable: 1.0,
  verified: 0.5,
  freshness: 0.6,
  serviceMatch: 0.2,
  openNow: 0.2,
};

const FRESHNESS_SCORE = {
  REAL_TIME: 1,
  RECENT: 0.8,
  DEMO: 0.4,
  STALE: 0.15,
  UNKNOWN: 0,
};

const AVAILABILITY_SCORE = {
  AVAILABLE: 1,
  LIMITED: 0.5,
  UNKNOWN: 0.2,
  FULL: 0,
  UNAVAILABLE: 0,
};

/**
 * Distance decays smoothly rather than stepping, so two facilities 400 m apart
 * do not swap places because of a bucket boundary.
 * 0 m -> 1.0, and the score halves every `halfLifeMeters`.
 */
function distanceScore(meters, halfLifeMeters = 3000) {
  if (meters == null) return 0;
  return 1 / (1 + meters / halfLifeMeters);
}

/**
 * Scores one facility and explains itself.
 *
 * @param {object} facility  serialized facility (distanceMeters, availability, ...)
 * @param {object} opts      { emergency: boolean, requestedService?: string }
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreFacility(facility, opts = {}) {
  const { emergency = false, requestedService = null } = opts;
  const w = emergency ? EMERGENCY_WEIGHTS : NORMAL_WEIGHTS;
  const reasons = [];
  let score = 0;

  const dScore = distanceScore(facility.distanceMeters);
  score += w.distance * dScore;
  if (facility.distanceMeters != null && facility.distanceMeters <= 2000) {
    reasons.push('Within 2 km');
  }

  if (facility.hasEmergency) {
    score += w.emergencyCapable;
    reasons.push('Has an emergency department');
  }

  if (facility.verificationStatus === 'VERIFIED') {
    score += w.verified;
    reasons.push('Verified facility');
  }

  // Freshness and availability are read off the emergency-department row where
  // there is one, otherwise the best row the facility reports.
  const edRow =
    facility.availability?.find((a) => a.resourceType === 'EMERGENCY_DEPARTMENT') ??
    facility.availability?.[0] ??
    null;

  if (edRow) {
    const f = FRESHNESS_SCORE[edRow.freshnessStatus] ?? 0;
    score += w.freshness * f;
    score += w.freshness * (AVAILABILITY_SCORE[edRow.status] ?? 0) * 0.5;

    if (edRow.freshnessStatus === 'RECENT' || edRow.freshnessStatus === 'REAL_TIME') {
      reasons.push('Recently updated availability');
    }
    if (edRow.freshnessStatus === 'STALE') {
      reasons.push('Availability may be outdated');
    }
    if (edRow.status === 'AVAILABLE') {
      reasons.push('Reports emergency capacity available');
    }
  } else {
    reasons.push('No availability information');
  }

  if (requestedService && facility.departments?.includes(requestedService)) {
    score += w.serviceMatch;
    reasons.push('Matches the department you searched for');
  }

  if (facility.openState === 'OPEN') {
    score += w.openNow;
    reasons.push('Open now');
  }

  return { score, reasons };
}

/**
 * Sorts a list and attaches rank + rankReason.
 * Ties break on distance so the order is stable and explainable.
 */
export function rankFacilities(facilities, opts = {}) {
  return facilities
    .map((f) => ({ facility: f, ...scoreFacility(f, opts) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.facility.distanceMeters ?? Infinity) - (b.facility.distanceMeters ?? Infinity);
    })
    .map((entry, index) => ({
      ...entry.facility,
      rank: index + 1,
      rankReason: entry.reasons,
    }));
}

/** Comparators for the non-emergency `sort` query parameter. */
export const SORTERS = {
  DISTANCE: (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
  VERIFICATION: (a, b) => {
    const rank = (f) => (f.verificationStatus === 'VERIFIED' ? 0 : 1);
    return rank(a) - rank(b) || SORTERS.DISTANCE(a, b);
  },
  AVAILABILITY: (a, b) => {
    const best = (f) =>
      Math.max(
        0,
        ...(f.availability ?? []).map((r) => AVAILABILITY_SCORE[r.status] ?? 0),
      );
    return best(b) - best(a) || SORTERS.DISTANCE(a, b);
  },
  RELEVANCE: null, // handled by scoreFacility
};
