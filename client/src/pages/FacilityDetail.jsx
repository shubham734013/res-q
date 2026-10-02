/**
 * ResQ — facility detail.
 *
 * Tabs match the build prompt minus Cost and Documents, which were cut from
 * scope: unreliable cost data on a healthcare product is a liability.
 */

import { Suspense, lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { facilityService } from '../services/index.js';
import { useLocation } from '../context/LocationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { AvailabilityList, ProvenanceLine, VerificationBadge } from '../components/Status.jsx';

import { ReportDialog } from '../components/ReportDialog.jsx';
import { DemoDataNotice, ErrorState, FacilitySkeleton } from '../components/States.jsx';
import { Button } from '../components/ui/index.jsx';
import {
  DAY_NAMES,
  FACILITY_TYPE_LABELS,
  directionsHref,
  formatDistance,
  telHref,
} from '../utils/display.js';

const TABS = ['Overview', 'Availability', 'Departments', 'Hours', 'Contact'];

/**
 * Leaflet is ~150 kB and is never needed on first paint. Loading it on demand
 * keeps it out of the initial bundle, which matters most for Emergency Mode.
 */
const MapView = lazy(() =>
  import('../components/MapView.jsx').then((m) => ({ default: m.MapView })),
);

export function FacilityDetailPage() {
  const { id } = useParams();
  const { location } = useLocation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('Overview');
  const [reporting, setReporting] = useState(false);

  const query = useQuery({
    queryKey: ['facility', id, location?.lat, location?.lng],
    queryFn: () => facilityService.detail(id, location),
  });

  const availability = useQuery({
    queryKey: ['availability', id],
    queryFn: () => facilityService.availability(id),
  });

  const save = useMutation({
    mutationFn: () => facilityService.save(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });

  if (query.isPending) return <FacilitySkeleton count={1} />;
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={query.refetch} title="Could not load this facility" />
    );
  }

  const f = query.data.facility;
  const phone = f.emergencyPhone ?? f.phone;

  return (
    <article className="space-y-6">
      {f.isDemoData && <DemoDataNotice />}

      <header>
        <p className="text-sm font-medium text-muted">
          {FACILITY_TYPE_LABELS[f.type] ?? f.type}
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight text-ink">{f.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerificationBadge status={f.verificationStatus} />
          {f.hasEmergency && (
            <span className="rounded bg-urgent-wash px-2 py-0.5 text-sm font-semibold text-urgent">
              Emergency department
            </span>
          )}
          {f.distanceMeters != null && (
            <span className="tnum text-sm font-medium text-ink-soft">
              {formatDistance(f.distanceMeters)} away
            </span>
          )}
        </div>

        <p className="mt-2 text-ink-soft">{f.address}</p>
        <ProvenanceLine provenance={f.provenance} className="mt-1" />
      </header>

      <div className="flex flex-wrap gap-2">
        {phone && (
          <Button as="a" href={telHref(phone)} size="lg">
            Call
          </Button>
        )}
        <Button
          as="a"
          href={directionsHref(f.latitude, f.longitude, f.name)}
          target="_blank"
          rel="noreferrer"
          size="lg"
          variant="secondary"
        >
          Directions
        </Button>
        {isAuthenticated && (
          <Button size="lg" variant="secondary" onClick={() => save.mutate()}>
            {save.isSuccess ? 'Saved' : 'Save'}
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={() => setReporting(true)}>
          Report a problem
        </Button>
      </div>

      <div className="border-b border-line">
        <div role="tablist" aria-label="Facility information" className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 font-medium ${
                tab === name
                  ? 'border-signal text-ink'
                  : 'border-transparent text-muted hover:text-ink-soft'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'Overview' && (
          <div className="space-y-5">
            {f.description && <p className="max-w-2xl text-ink-soft">{f.description}</p>}
            <Suspense fallback={<div className="skeleton h-[320px] rounded-[6px]" />}>
              <MapView center={{ lat: f.latitude, lng: f.longitude }} facilities={[f]} />
            </Suspense>
            {f.services.length > 0 && (
              <div>
                <h2 className="font-semibold text-ink">Services</h2>
                <p className="mt-1 text-ink-soft">{f.services.map((s) => s.name).join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'Availability' && (
          <AvailabilityList
            rows={availability.data?.availability ?? f.availability}
            disclaimer={availability.data?.disclaimer}
          />
        )}

        {tab === 'Departments' && (
          <ul className="divide-y divide-line">
            {f.departments.length === 0 && <li className="py-3 text-ink-soft">No departments listed.</li>}
            {f.departments.map((d) => (
              <li key={d.id} className="py-3">
                <p className="font-medium text-ink">{d.name}</p>
                {d.description && <p className="text-sm text-muted">{d.description}</p>}
              </li>
            ))}
          </ul>
        )}

        {tab === 'Hours' && (
          <ul className="divide-y divide-line">
            {f.operatingHours.length === 0 && (
              <li className="py-3 text-ink-soft">No opening hours recorded.</li>
            )}
            {[...f.operatingHours]
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
              .map((h) => (
                <li key={h.dayOfWeek} className="flex justify-between py-2.5">
                  <span className="text-ink-soft">{DAY_NAMES[h.dayOfWeek]}</span>
                  <span className="tnum font-medium text-ink">
                    {h.is24Hours
                      ? 'Open 24 hours'
                      : h.isClosed
                        ? 'Closed'
                        : h.openTime && h.closeTime
                          ? `${h.openTime} – ${h.closeTime}`
                          : 'Not recorded'}
                  </span>
                </li>
              ))}
          </ul>
        )}

        {tab === 'Contact' && (
          <dl className="divide-y divide-line">
            {[
              ['Phone', f.phone],
              ['Emergency phone', f.emergencyPhone],
              ['Address', f.address],
              ['City', f.city],
              ['Website', f.website],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2 py-2.5">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="font-medium text-ink">
                  {value ? (
                    label === 'Website' ? (
                      <a href={value} className="text-signal underline" target="_blank" rel="noreferrer">
                        {value}
                      </a>
                    ) : (
                      value
                    )
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <ReportDialog
        facilityId={f.id}
        facilityName={f.name}
        open={reporting}
        onClose={() => setReporting(false)}
      />
    </article>
  );
}
