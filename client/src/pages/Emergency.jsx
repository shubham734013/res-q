/**
 * ResQ — Emergency Mode.
 *
 * Its own layout, deliberately: no main nav, no filters, no account chrome.
 * Large targets, short text, and the safety notice above everything.
 *
 * Degradation (TDD §15.3) is the whole design here. Location denied → manual
 * area. Map dead → list only. Availability stale → say so. None of those stop
 * Call and Directions from rendering.
 */

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { emergencyService } from '../services/index.js';
import { KNOWN_PLACES, useLocation } from '../context/LocationContext.jsx';
import { StatusBadge, ProvenanceLine, VerificationBadge } from '../components/Status.jsx';
import { DemoDataNotice, ErrorState } from '../components/States.jsx';
import { Button } from '../components/ui/index.jsx';
import { directionsHref, formatDistance, railClass, telHref } from '../utils/display.js';

export function EmergencyPage() {
  const { location, requestPrecise, setManual, isLocating, error: locationError } = useLocation();
  // A ref, not state: starting the session must not itself cause a render, and
  // the mutation object's identity changes on every render.
  const startedFor = useRef(null);

  const session = useMutation({
    mutationFn: (payload) => emergencyService.startSession(payload),
  });

  // Auto-start as soon as a location is known. One less tap during an emergency.
  const key = location ? `${location.lat},${location.lng}` : null;
  const start = session.mutate;
  useEffect(() => {
    if (!location || startedFor.current === key) return;
    startedFor.current = key;
    start({
      latitude: location.lat,
      longitude: location.lng,
      radiusKm: 25,
      locationIsManual: !location.isPrecise,
    });
  }, [location, key, start]);

  const data = session.data;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="bg-urgent px-4 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Emergency assistance</h1>
          <Link to="/" className="shrink-0 text-base font-semibold underline">
            Exit
          </Link>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-[17px] leading-snug">
          If this is life-threatening, contact your local emergency service immediately.
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        {!location && (
          <section className="rounded-[6px] border border-line bg-surface p-4">
            <h2 className="text-lg font-semibold text-ink">Where are you?</h2>
            <p className="mt-1 text-ink-soft">
              ResQ needs a starting point to find the nearest emergency departments.
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={requestPrecise} disabled={isLocating}>
              {isLocating ? 'Finding you…' : 'Use my location'}
            </Button>

            {locationError && <p className="mt-3 text-[15px] text-caution">{locationError}</p>}

            <p className="mt-4 text-sm font-semibold text-ink-soft">Or choose an area</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {KNOWN_PLACES.map((p) => (
                <Button key={p.label} variant="secondary" size="lg" onClick={() => setManual(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </section>
        )}

        {session.isPending && (
          <p className="rounded-[6px] border border-line bg-surface p-4 text-lg text-ink-soft">
            Finding the nearest emergency facilities…
          </p>
        )}

        {session.isError && (
          <ErrorState
            error={session.error}
            title="Could not load emergency facilities"
            onRetry={() => {
              startedFor.current = null;
              session.reset();
            }}
          />
        )}

        {data && (
          <>
            {data.containsDemoData && <DemoDataNotice />}

            {data.degraded.usingManualLocation && (
              <p className="rounded-[6px] border border-line bg-surface px-3 py-2 text-[15px] text-ink-soft">
                Using the area you chose, not your exact position. Distances are approximate.
              </p>
            )}
            {data.degraded.availabilityStale && (
              <p className="rounded-[6px] border border-caution/40 bg-caution-wash px-3 py-2 text-[15px] text-caution">
                Availability information for these facilities may be outdated. Call to confirm.
              </p>
            )}

            <h2 className="pt-1 text-xl font-bold text-ink">Nearest emergency facilities</h2>

            {data.facilities.length === 0 ? (
              <div className="rounded-[6px] border border-line bg-surface p-5">
                <p className="text-lg font-semibold text-ink">
                  No emergency facilities found within 25 km
                </p>
                <p className="mt-1 text-ink-soft">
                  Contact your local emergency service directly — they can direct you.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.facilities.map((f) => {
                  const ed =
                    f.availability?.find((a) => a.resourceType === 'EMERGENCY_DEPARTMENT') ??
                    f.availability?.[0] ??
                    null;
                  const phone = f.emergencyPhone ?? f.phone;

                  return (
                    <li
                      key={f.id}
                      className="flex items-stretch gap-3 rounded-[6px] border border-line bg-surface p-4"
                    >
                      <span className={railClass(ed)} aria-hidden="true" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-xl font-semibold leading-tight text-ink">
                            {f.name}
                          </h3>
                          <span className="tnum shrink-0 text-lg font-bold text-ink">
                            {formatDistance(f.distanceMeters)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <VerificationBadge status={f.verificationStatus} />
                          {ed ? (
                            <StatusBadge status={ed.status} />
                          ) : (
                            <span className="text-[15px] font-medium text-caution">
                              No availability information
                            </span>
                          )}
                        </div>
                        {ed && <ProvenanceLine provenance={ed} className="mt-1" />}

                        {f.rankReason?.length > 0 && (
                          // Why this facility is listed here. The ranking has to
                          // be explainable, not an opaque score (master §55).
                          <p className="mt-1.5 text-[15px] text-ink-soft">
                            {f.rankReason.join(' · ')}
                          </p>
                        )}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {phone && (
                            <Button as="a" href={telHref(phone)} size="lg" variant="urgent">
                              Call
                            </Button>
                          )}
                          <Button
                            as="a"
                            href={directionsHref(f.latitude, f.longitude, f.name)}
                            target="_blank"
                            rel="noreferrer"
                            size="lg"
                          >
                            Directions
                          </Button>
                        </div>

                        <Link
                          to={`/facility/${f.id}`}
                          className="mt-3 inline-block text-[15px] font-medium text-signal underline"
                        >
                          Full details
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="pt-2 text-[15px] text-ink-soft">
              ResQ cannot reserve a bed or confirm that a hospital will accept a patient. Call the
              facility before travelling when you can.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
