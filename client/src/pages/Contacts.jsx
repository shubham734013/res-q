/**
 * ResQ — emergency contacts.
 *
 * Priority 1 is the person called first. No continuous tracking exists and
 * none should be added here without a separate consent flow.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { emergencyService } from '../services/index.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { Button, Field, Input, Select, Spinner } from '../components/ui/index.jsx';

const BLANK = { name: '', phone: '', relationship: '', priority: 1 };

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(BLANK);

  const contacts = useQuery({ queryKey: ['contacts'], queryFn: emergencyService.contacts });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts'] });

  const create = useMutation({
    mutationFn: () =>
      emergencyService.createContact({
        ...form,
        relationship: form.relationship || undefined,
        priority: Number(form.priority),
      }),
    onSuccess: () => {
      setForm(BLANK);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id) => emergencyService.deleteContact(id),
    onSuccess: invalidate,
  });

  const items = contacts.data?.contacts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Emergency contacts</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          In Emergency Mode you can send these people your location. Nothing is sent automatically,
          and ResQ never tracks you in the background.
        </p>
      </div>

      <form
        className="grid gap-4 rounded-[6px] border border-line bg-surface p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Name" required>
          {(p) => (
            <Input
              {...p}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </Field>

        <Field label="Phone" required>
          {(p) => (
            <Input
              {...p}
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          )}
        </Field>

        <Field label="Relationship">
          {(p) => (
            <Input
              {...p}
              value={form.relationship}
              placeholder="Sister, neighbour, colleague"
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            />
          )}
        </Field>

        <Field label="Call order" hint="1 is contacted first.">
          {(p) => (
            <Select
              {...p}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="sm:col-span-2">
          {create.isError && <ErrorState error={create.error} title="Contact not added" />}
          <Button type="submit" disabled={create.isPending} className="mt-2">
            {create.isPending ? 'Adding…' : 'Add contact'}
          </Button>
        </div>
      </form>

      {contacts.isPending && <Spinner label="Loading contacts" />}
      {contacts.isError && <ErrorState error={contacts.error} onRetry={contacts.refetch} />}

      {contacts.isSuccess && items.length === 0 && (
        <EmptyState
          title="No emergency contacts added"
          body="Add at least one person who should know where you are if something happens."
        />
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-semibold text-ink">
                  <span className="tnum mr-2 text-muted">{c.priority}</span>
                  {c.name}
                </p>
                <p className="tnum text-sm text-ink-soft">
                  {c.phone}
                  {c.relationship && <span className="text-muted"> · {c.relationship}</span>}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(c.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
