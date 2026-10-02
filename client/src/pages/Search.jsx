/**
 * ResQ — search.
 *
 * Filters live in the URL so a result set can be shared or reloaded, which
 * matters when someone sends "these three hospitals" to a family member.
 */

import { Suspense, lazy, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { facilityService } from '../services/index.js';
import { useLocation } from '../context/LocationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { FacilityCard } from '../components/FacilityCard.jsx';

import { LocationPicker } from '../components/LocationPicker.jsx';
import { DemoDataNotice, EmptyState, ErrorState, FacilitySkeleton } from '../components/States.jsx';
import { Button, Field, Input, Select } from '../components/ui/index.jsx';
import { FACILITY_TYPE_LABELS } from '../utils/display.js';

const SORTS = [
  ['DISTANCE', 'Nearest first'],
  ['RELEVANCE', 'Best match'],
  ['AVAILABILITY', 'Reported availability'],
  ['VERIFICATION', 'Verified first'],
];

/**
 * Leaflet is ~150 kB and is never needed on first paint. Loading it on demand
 * keeps it out of the initial bundle, which matters most for Emergency Mode.
 */
const MapView = lazy(() =>
  import('../components/MapView.jsx').then((m) => ({ default: m.MapView })),
);

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { location, hasLocation } = useLocation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [mapFailed, setMapFailed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      type: params.get('type') ?? '',
      department: params.get('department') ?? '',
      radiusKm: params.get('radiusKm') ?? '10',
      emergency: params.get('emergency') ?? '',
      verified: params.get('verified') ?? '',
      openNow: params.get('openNow') ?? '',
      sort: params.get('sort') ?? 'DISTANCE',
    }),
    [params],
  );

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: facilityService.meta,
    staleTime: 60 * 60 * 1000,
  });

  const results = useQuery({
    queryKey: ['nearby', location?.lat, location?.lng, filters],
    enabled: hasLocation,
    queryFn: () =>
      facilityService.nearby({
        lat: location.lat,
        lng: location.lng,
        radiusKm: filters.radiusKm,
        q: filters.q || undefined,
        type: filters.type || undefined,
        department: filters.department || undefined,
        emergency: filters.emergency || undefined,
        verified: filters.verified || undefined,
        openNow: filters.openNow || undefined,
        sort: filters.sort,
        limit: 20,
      }),
  });

  const save = useMutation({
    mutationFn: (facility) => facilityService.save(facility.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });

  const items = results.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Find healthcare</h1>
        <p className="mt-1 text-ink-soft">
          {hasLocation
            ? `Searching within ${filters.radiusKm} km of ${location.label}.`
            : 'Choose an area or share your location to begin.'}
        </p>
      </div>

      <LocationPicker />

      {!hasLocation ? (
        <EmptyState
          title="No location set"
          body="ResQ needs a starting point to measure distance from. Pick an area above, or share your location."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Facility name">
                {(p) => (
                  <Input
                    {...p}
                    type="search"
                    value={filters.q}
                    placeholder="Search by name"
                    onChange={(e) => update({ q: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="w-full sm:w-52">
              <Field label="Sort by">
                {(p) => (
                  <Select {...p} value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
                    {SORTS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              {showFilters ? 'Hide filters' : 'More filters'}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-4 rounded-[6px] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Facility type">
                {(p) => (
                  <Select {...p} value={filters.type} onChange={(e) => update({ type: e.target.value })}>
                    <option value="">Any type</option>
                    {Object.entries(FACILITY_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Department">
                {(p) => (
                  <Select
                    {...p}
                    value={filters.department}
                    onChange={(e) => update({ department: e.target.value })}
                  >
                    <option value="">Any department</option>
                    {(meta.data?.departments ?? []).map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Distance">
                {(p) => (
                  <Select
                    {...p}
                    value={filters.radiusKm}
                    onChange={(e) => update({ radiusKm: e.target.value })}
                  >
                    {['2', '5', '10', '25', '50'].map((km) => (
                      <option key={km} value={km}>
                        Within {km} km
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Show only</legend>
                {[
                  ['emergency', 'With an emergency department'],
                  ['verified', 'Verified facilities'],
                  ['openNow', 'Open now'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-[15px] text-ink-soft">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={filters[key] === 'true'}
                      onChange={(e) => update({ [key]: e.target.checked ? 'true' : '' })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
          )}

          {results.data?.containsDemoData && <DemoDataNotice />}

          {!mapFailed && items.length > 0 && (
            <Suspense fallback={<div className="skeleton h-[320px] rounded-[6px]" />}>
              <MapView center={location} facilities={items} onError={() => setMapFailed(true)} />
            </Suspense>
          )}
          {mapFailed && (
            <p className="rounded-[6px] border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
              The map could not load. The list below has the same results.
            </p>
          )}

          {results.isPending && <FacilitySkeleton />}

          {results.isError && (
            <ErrorState
              error={results.error}
              onRetry={results.refetch}
              title="Could not load facilities"
            />
          )}

          {results.isSuccess && items.length === 0 && (
            <EmptyState
              title="No facilities found nearby"
              body="Nothing matched inside this radius. Widening the distance or clearing a filter usually helps."
              action={
                <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </Button>
              }
            />
          )}

          {items.length > 0 && (
            <>
              <p className="tnum text-sm text-muted">
                {results.data.pagination.total} result
                {results.data.pagination.total === 1 ? '' : 's'}
              </p>
              <ul className="divide-y divide-line border-y border-line">
                {items.map((facility) => (
                  <FacilityCard
                    key={facility.id}
                    facility={facility}
                    showRank={filters.sort === 'RELEVANCE'}
                    onSave={isAuthenticated ? save.mutate : undefined}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
