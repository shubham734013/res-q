/**
 * ResQ — report triage (SUPER_ADMIN).
 *
 * The reporter's identity is not available here by design: the API returns only
 * whether a report was anonymous. Triage needs the problem, not the person.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reportService } from '../services/index.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { Button, Field, Input, Select, Spinner } from '../components/ui/index.jsx';
import { REPORT_CATEGORY_LABELS } from '../utils/display.js';

const STATUSES = ['OPEN', 'TRIAGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];

export function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [notes, setNotes] = useState({});

  const reports = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => reportService.adminList({ status: statusFilter || undefined, limit: 50 }),
  });

  const update = useMutation({
    mutationFn: ({ id, status, resolutionNote }) =>
      reportService.adminUpdate(id, { status, resolutionNote: resolutionNote || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  const items = reports.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Reports</h1>
        <p className="mt-1 text-ink-soft">
          Resolving or dismissing a report needs a note — it becomes the record of why.
        </p>
      </div>

      <div className="max-w-xs">
        <Field label="Status">
          {(p) => (
            <Select {...p} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All reports</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {reports.isPending && <Spinner label="Loading reports" />}
      {reports.isError && <ErrorState error={reports.error} onRetry={reports.refetch} />}

      {reports.isSuccess && items.length === 0 && (
        <EmptyState title="Nothing to review" body="No reports match this filter." />
      )}

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((r) => {
            const note = notes[r.id] ?? '';
            return (
              <li key={r.id} className="rounded-[6px] border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-ink">
                    <Link to={`/facility/${r.facility.id}`} className="hover:underline">
                      {r.facility.name}
                    </Link>
                    <span className="font-normal text-muted"> · {r.facility.city}</span>
                  </h2>
                  <span className="rounded bg-paper px-2 py-0.5 text-sm font-medium text-ink-soft">
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                </div>

                <p className="mt-1 text-sm font-medium text-ink-soft">
                  {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                  {r.isAnonymous && <span className="text-muted"> · reported anonymously</span>}
                </p>

                <p className="mt-2 text-ink-soft">{r.description}</p>

                {r.resolutionNote && (
                  <p className="mt-2 rounded bg-paper p-2 text-sm text-ink-soft">
                    Resolution: {r.resolutionNote}
                  </p>
                )}

                {r.status !== 'RESOLVED' && r.status !== 'DISMISSED' && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <Field label="Resolution note">
                        {(p) => (
                          <Input
                            {...p}
                            value={note}
                            placeholder="What you checked and changed"
                            onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                          />
                        )}
                      </Field>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => update.mutate({ id: r.id, status: 'INVESTIGATING' })}
                    >
                      Investigating
                    </Button>
                    <Button
                      size="sm"
                      disabled={note.trim().length === 0}
                      onClick={() =>
                        update.mutate({ id: r.id, status: 'RESOLVED', resolutionNote: note })
                      }
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={note.trim().length === 0}
                      onClick={() =>
                        update.mutate({ id: r.id, status: 'DISMISSED', resolutionNote: note })
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {update.isError && <ErrorState error={update.error} title="Report not updated" />}
    </div>
  );
}
