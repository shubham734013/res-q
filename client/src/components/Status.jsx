/**
 * ResQ — status, verification and provenance display.
 *
 * These three components are the visible half of the trust model. Every one of
 * them pairs colour with a glyph or with words, so meaning survives greyscale
 * printing, low-quality screens and colour-blindness.
 */

import {
  RESOURCE_LABELS,
  STATUS_PRESENTATION,
  VERIFICATION_LABELS,
  freshnessLabel,
  railClass,
} from '../utils/display.js';

const TONE_CLASSES = {
  verified: 'bg-verified-wash text-verified',
  caution: 'bg-caution-wash text-caution',
  ink: 'bg-paper text-ink',
  muted: 'bg-paper text-muted',
};

export function StatusBadge({ status, className = '' }) {
  const p = STATUS_PRESENTATION[status] ?? STATUS_PRESENTATION.UNKNOWN;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-sm font-semibold ${TONE_CLASSES[p.tone]} ${className}`}
    >
      <span aria-hidden="true">{p.glyph}</span>
      {p.label}
    </span>
  );
}

export function VerificationBadge({ status }) {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-verified-wash px-2 py-0.5 text-sm font-semibold text-verified">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="currentColor">
          <path d="M8 0l2 1.6 2.5-.3.8 2.4 2.1 1.4-1 2.3 1 2.3-2.1 1.4-.8 2.4-2.5-.3L8 16l-2-1.6-2.5.3-.8-2.4L.6 10.9l1-2.3-1-2.3 2.1-1.4.8-2.4L6 2.6 8 0zm3.4 5.3l-1.1-1-3 3.4-1.6-1.5-1 1.1 2.7 2.5 4-4.5z" />
        </svg>
        Verified
      </span>
    );
  }

  // Everything else states its own weaker claim rather than showing nothing.
  // A silent gap reads as "fine"; it is not.
  return (
    <span className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 text-sm font-medium text-muted">
      {VERIFICATION_LABELS[status] ?? 'Unverified'}
    </span>
  );
}

/** The timestamp and its source, always together. Never one without the other. */
export function ProvenanceLine({ provenance, className = '' }) {
  if (!provenance) return null;
  const stale = provenance.freshnessStatus === 'STALE';
  const unknown = provenance.freshnessStatus === 'UNKNOWN';

  const label = freshnessLabel(provenance);
  // On demo rows the label and the source name are both "Demo data"; printing
  // both reads as a glitch. Say it once.
  const source =
    provenance.source && provenance.source.toLowerCase() !== label.toLowerCase()
      ? provenance.source
      : null;

  return (
    <p className={`text-sm ${stale || unknown ? 'text-caution' : 'text-muted'} ${className}`}>
      <span className="tnum">{label}</span>
      {source && <span className="text-muted"> · {source}</span>}
    </p>
  );
}

/** One availability row: resource, status, count where trustworthy, provenance. */
export function AvailabilityRow({ row }) {
  return (
    <li className="flex items-stretch gap-3 py-3">
      <span className={railClass(row)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-ink">
            {RESOURCE_LABELS[row.resourceType] ?? row.resourceType}
          </span>
          <StatusBadge status={row.status} />
          {row.count != null && (
            <span className="tnum text-sm text-muted">{row.count} reported</span>
          )}
        </div>
        <ProvenanceLine provenance={row} className="mt-0.5" />
        {row.note && <p className="mt-1 text-sm text-ink-soft">{row.note}</p>}
      </div>
    </li>
  );
}

export function AvailabilityList({ rows, disclaimer }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-[6px] border border-line bg-paper p-4">
        <p className="font-semibold text-ink">No availability information</p>
        <p className="mt-1 text-sm text-ink-soft">
          Nobody has reported capacity for this facility. Call before travelling.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <AvailabilityRow key={row.resourceType} row={row} />
        ))}
      </ul>
      {disclaimer && <p className="mt-3 text-sm text-muted">{disclaimer}</p>}
    </div>
  );
}
