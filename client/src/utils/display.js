/**
 * ResQ — display helpers.
 *
 * The status and freshness vocabularies live here so a label cannot drift
 * between the search page and the detail page. Every status pairs a glyph with
 * a colour: colour alone must never carry meaning (master prompt §32).
 */

export const STATUS_PRESENTATION = {
  AVAILABLE: { glyph: '●', label: 'Available', tone: 'verified' },
  LIMITED: { glyph: '▲', label: 'Limited', tone: 'caution' },
  FULL: { glyph: '■', label: 'Full', tone: 'ink' },
  UNAVAILABLE: { glyph: '×', label: 'Unavailable', tone: 'ink' },
  UNKNOWN: { glyph: '?', label: 'Unknown', tone: 'muted' },
};

export const RESOURCE_LABELS = {
  EMERGENCY_DEPARTMENT: 'Emergency department',
  GENERAL_BED: 'General beds',
  ICU_BED: 'ICU beds',
  VENTILATOR: 'Ventilators',
  AMBULANCE: 'Ambulance',
  OXYGEN: 'Oxygen',
};

export const FACILITY_TYPE_LABELS = {
  GOVERNMENT_HOSPITAL: 'Government hospital',
  PRIVATE_HOSPITAL: 'Private hospital',
  TRAUMA_CENTER: 'Trauma centre',
  EMERGENCY_CENTER: 'Emergency centre',
  CLINIC: 'Clinic',
  DIAGNOSTIC_CENTER: 'Diagnostic centre',
  BLOOD_BANK: 'Blood bank',
  PHARMACY: 'Pharmacy',
  AMBULANCE_PROVIDER: 'Ambulance provider',
};

export const VERIFICATION_LABELS = {
  VERIFIED: 'Verified',
  PENDING_REVIEW: 'Awaiting review',
  UNVERIFIED: 'Unverified',
  REJECTED: 'Rejected',
  EXPIRED: 'Verification expired',
  SUSPENDED: 'Suspended',
};

export const REPORT_CATEGORY_LABELS = {
  INCORRECT_PHONE: 'Phone number is wrong',
  INCORRECT_ADDRESS: 'Address or location is wrong',
  INCORRECT_HOURS: 'Opening hours are wrong',
  INCORRECT_DEPARTMENT: 'Departments listed are wrong',
  INCORRECT_SERVICE: 'Services listed are wrong',
  INCORRECT_AVAILABILITY: 'Availability is wrong',
  INCORRECT_BLOOD_INFO: 'Blood availability is wrong',
  DUPLICATE_FACILITY: 'This is a duplicate listing',
  FACILITY_CLOSED: 'This facility has closed',
  OTHER: 'Something else',
};

/** Which rail pattern a provenance block earns. See .rail-* in index.css. */
export function railClass(provenance) {
  switch (provenance?.freshnessStatus) {
    case 'REAL_TIME':
    case 'RECENT':
      return 'rail rail-recent';
    case 'DEMO':
      return 'rail rail-demo';
    case 'STALE':
      return 'rail rail-stale';
    default:
      return 'rail rail-unknown';
  }
}

/**
 * Mirrors the server's freshnessLabel. Duplicated deliberately — the build
 * prompt chose duplication over a shared package, and this is one of the few
 * places that costs.
 */
export function freshnessLabel(provenance, now = new Date()) {
  if (!provenance) return 'No information';
  if (provenance.freshnessStatus === 'DEMO') return 'Demo data';
  if (!provenance.lastUpdatedAt) return 'No recent information';

  const minutes = Math.floor((now.getTime() - new Date(provenance.lastUpdatedAt).getTime()) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function formatDistance(meters) {
  if (meters == null) return null;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** tel: links must not contain spaces or formatting characters. */
export const telHref = (phone) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);

/**
 * Directions open in the user's own map app. ResQ does not route internally —
 * sending someone to a tool they already trust for navigation is both safer
 * and better than reimplementing turn-by-turn.
 */
export const directionsHref = (lat, lng, label) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
    label ? `&destination_place_id=&travelmode=driving` : ''
  }`;
