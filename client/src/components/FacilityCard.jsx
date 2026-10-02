/**
 * ResQ — a facility in a result list.
 *
 * Reading order is the decision order: how far, can they take an emergency,
 * how much should I trust this, then the actions. The confidence rail runs the
 * full height on the leading edge so the trust signal is readable before any
 * text is.
 */

import { Link } from 'react-router-dom';
import { StatusBadge, ProvenanceLine, VerificationBadge } from './Status.jsx';
import {
  FACILITY_TYPE_LABELS,
  directionsHref,
  formatDistance,
  railClass,
  telHref,
} from '../utils/display.js';
import { Button } from './ui/index.jsx';

export function FacilityCard({ facility, onSave, isSaved, showRank = false }) {
  // Prefer the emergency row; fall back to any reported resource. When the
  // facility reports nothing at all the rail stays hollow — it must not borrow
  // the facility record's freshness and imply we know something about capacity.
  const emergencyRow =
    facility.availability?.find((a) => a.resourceType === 'EMERGENCY_DEPARTMENT') ??
    facility.availability?.[0] ??
    null;
  const phone = facility.emergencyPhone ?? facility.phone;
  const distance = formatDistance(facility.distanceMeters);

  return (
    <li className="flex items-stretch gap-3 py-4">
      <span className={railClass(emergencyRow)} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight text-ink">
            {showRank && (
              <span className="tnum mr-2 text-muted" aria-label={`Rank ${facility.rank}`}>
                {facility.rank}
              </span>
            )}
            <Link to={`/facility/${facility.id}`} className="hover:underline">
              {facility.name}
            </Link>
          </h3>
          {distance && (
            <span className="tnum shrink-0 font-semibold text-ink-soft">{distance}</span>
          )}
        </div>

        <p className="mt-0.5 text-sm text-muted">
          {FACILITY_TYPE_LABELS[facility.type] ?? facility.type} · {facility.city}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <VerificationBadge status={facility.verificationStatus} />
          {facility.hasEmergency ? (
            <span className="rounded bg-urgent-wash px-2 py-0.5 text-sm font-semibold text-urgent">
              Emergency department
            </span>
          ) : (
            <span className="rounded bg-paper px-2 py-0.5 text-sm text-muted">
              No emergency department
            </span>
          )}
          {facility.openState === 'OPEN' && (
            <span className="text-sm font-medium text-verified">Open now</span>
          )}
          {facility.openState === 'CLOSED' && (
            <span className="text-sm font-medium text-muted">Closed now</span>
          )}
        </div>

        {emergencyRow ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm text-ink-soft">Emergency capacity</span>
            <StatusBadge status={emergencyRow.status} />
            <ProvenanceLine provenance={emergencyRow} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-caution">No availability information</p>
        )}

        {facility.departments?.length > 0 && (
          <p className="mt-2 line-clamp-1 text-sm text-muted">
            {facility.departments.slice(0, 4).join(', ')}
          </p>
        )}

        {showRank && facility.rankReason?.length > 0 && (
          // Why this facility is where it is. Required by §55: the ranking must
          // be explainable, not an opaque score.
          <p className="mt-2 text-sm text-ink-soft">{facility.rankReason.join(' · ')}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {phone && (
            <Button as="a" href={telHref(phone)} size="sm" variant="secondary">
              Call
            </Button>
          )}
          <Button
            as="a"
            href={directionsHref(facility.latitude, facility.longitude, facility.name)}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="secondary"
          >
            Directions
          </Button>
          <Button as={Link} to={`/facility/${facility.id}`} size="sm" variant="ghost">
            Details
          </Button>
          {onSave && (
            <Button size="sm" variant="ghost" onClick={() => onSave(facility)}>
              {isSaved ? 'Saved' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
