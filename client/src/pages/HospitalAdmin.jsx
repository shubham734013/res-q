/**
 * ResQ — hospital admin.
 *
 * Deliberately narrow: contact details, hours and availability. Name, type,
 * coordinates and verification status are absent because the API refuses them —
 * those are identity and trust fields that only a platform administrator may
 * change. Showing a disabled input would misrepresent what is possible.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hospitalAdminService } from '../services/index.js';
import { AvailabilityList } from '../components/Status.jsx';
import { ErrorState, FacilitySkeleton } from '../components/States.jsx';
import { Button, Field, Input, Select } from '../components/ui/index.jsx';
import { RESOURCE_LABELS } from '../utils/display.js';

const RESOURCES = Object.keys(RESOURCE_LABELS);
const STATUSES = ['AVAILABLE', 'LIMITED', 'FULL', 'UNAVAILABLE', 'UNKNOWN'];

export function HospitalAdminPage() {
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState(undefined);
  const [draft, setDraft] = useState({});
  const [contact, setContact] = useState(null);

  const query = useQuery({
    queryKey: ['hospital-admin', facilityId],
    queryFn: () => hospitalAdminService.facility(facilityId),
  });

  const facility = query.data?.facility;

  // Keyed on the facility id, not the query result. TanStack refetches on
  // window focus; resyncing on every result would discard a half-typed edit the
  // moment the user tabbed away and back.
  const syncedFor = useRef(null);
  useEffect(() => {
    if (!facility || syncedFor.current === facility.id) return;
    syncedFor.current = facility.id;
    setContact({
      phone: facility.phone ?? '',
      emergencyPhone: facility.emergencyPhone ?? '',
      address: facility.address ?? '',
    });
    setDraft(
      Object.fromEntries(
        facility.availability.map((a) => [a.resourceType, { status: a.status, count: a.count }]),
      ),
    );
  }, [facility]);

  const saveAvailability = useMutation({
    mutationFn: () =>
      hospitalAdminService.updateAvailability({
        facilityId,
        updates: Object.entries(draft)
          .filter(([, v]) => v?.status)
          .map(([resourceType, v]) => ({
            resourceType,
            status: v.status,
            // A count alongside UNKNOWN or a positive count on FULL is rejected
            // by the API; drop it here so the user sees a save, not a 400.
            count: v.status === 'UNKNOWN' || v.status === 'FULL' ? null : (v.count ?? null),
          })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hospital-admin'] }),
  });

  const saveContact = useMutation({
    mutationFn: () => hospitalAdminService.updateFacility({ facilityId, ...contact }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hospital-admin'] }),
  });

  if (query.isPending) return <FacilitySkeleton count={2} />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load your facility" />;
  }

  const managed = query.data.managedFacilityIds ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{facility.name}</h1>
        <p className="mt-1 text-ink-soft">
          Updates here appear to the public immediately, stamped with the time you saved them.
        </p>

        {managed.length > 1 && (
          <div className="mt-4 max-w-sm">
            <Field label="Facility">
              {(p) => (
                <Select
                  {...p}
                  value={facilityId ?? managed[0]}
                  onChange={(e) => setFacilityId(e.target.value)}
                >
                  {managed.map((id) => (
                    <option key={id} value={id}>
                      {id === facility.id ? facility.name : id}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </div>

      <section aria-labelledby="availability">
        <h2 id="availability" className="text-xl font-semibold text-ink">
          Current availability
        </h2>
        <p className="mt-1 text-ink-soft">
          Set a resource to Unknown rather than leaving an old value in place. Unknown is honest;
          a stale number is not.
        </p>

        <div className="mt-4 space-y-3">
          {RESOURCES.map((resource) => {
            const value = draft[resource] ?? { status: 'UNKNOWN', count: null };
            const countDisabled = value.status === 'UNKNOWN' || value.status === 'FULL';

            return (
              <div
                key={resource}
                className="grid items-end gap-3 rounded-[6px] border border-line bg-surface p-3 sm:grid-cols-[1fr_12rem_8rem]"
              >
                <p className="font-medium text-ink">{RESOURCE_LABELS[resource]}</p>

                <Field label="Status">
                  {(p) => (
                    <Select
                      {...p}
                      value={value.status}
                      onChange={(e) =>
                        setDraft({ ...draft, [resource]: { ...value, status: e.target.value } })
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Field label="Count" hint={countDisabled ? 'Not applicable' : undefined}>
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      min={0}
                      disabled={countDisabled}
                      value={value.count ?? ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [resource]: {
                            ...value,
                            count: e.target.value === '' ? null : Number(e.target.value),
                          },
                        })
                      }
                    />
                  )}
                </Field>
              </div>
            );
          })}
        </div>

        {saveAvailability.isError && (
          <ErrorState error={saveAvailability.error} title="Availability not saved" />
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => saveAvailability.mutate()} disabled={saveAvailability.isPending}>
            {saveAvailability.isPending ? 'Saving…' : 'Save availability'}
          </Button>
          {saveAvailability.isSuccess && (
            <span className="text-[15px] font-medium text-verified">Availability saved</span>
          )}
        </div>
      </section>

      <section aria-labelledby="published" className="border-t border-line pt-6">
        <h2 id="published" className="text-xl font-semibold text-ink">
          What the public sees
        </h2>
        <div className="mt-3">
          <AvailabilityList rows={facility.availability} />
        </div>
      </section>

      {contact && (
        <section aria-labelledby="contact" className="border-t border-line pt-6">
          <h2 id="contact" className="text-xl font-semibold text-ink">
            Contact details
          </h2>
          <form
            className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveContact.mutate();
            }}
          >
            <Field label="Phone">
              {(p) => (
                <Input
                  {...p}
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              )}
            </Field>
            <Field label="Emergency phone">
              {(p) => (
                <Input
                  {...p}
                  value={contact.emergencyPhone}
                  onChange={(e) => setContact({ ...contact, emergencyPhone: e.target.value })}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                {(p) => (
                  <Input
                    {...p}
                    value={contact.address}
                    onChange={(e) => setContact({ ...contact, address: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <div className="sm:col-span-2">
              {saveContact.isError && (
                <ErrorState error={saveContact.error} title="Details not saved" />
              )}
              <div className="mt-2 flex items-center gap-3">
                <Button type="submit" disabled={saveContact.isPending}>
                  {saveContact.isPending ? 'Saving…' : 'Save details'}
                </Button>
                {saveContact.isSuccess && (
                  <span className="text-[15px] font-medium text-verified">Details saved</span>
                )}
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
