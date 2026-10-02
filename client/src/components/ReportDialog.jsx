/**
 * ResQ — report incorrect information.
 *
 * Open to anonymous users: a person who spots a wrong phone number should not
 * have to register to tell us. A native <dialog> gives focus trapping and Esc
 * handling without a dependency.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reportService } from '../services/index.js';
import { REPORT_CATEGORY_LABELS } from '../utils/display.js';
import { Button, Field, Select, Textarea } from './ui/index.jsx';
import { ErrorState } from './States.jsx';

export function ReportDialog({ facilityId, facilityName, open, onClose }) {
  const ref = useRef(null);
  const [category, setCategory] = useState('INCORRECT_PHONE');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => reportService.create({ facilityId, category, description }),
  });

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(undefined, {
      onSuccess: () => {
        setDescription('');
        // Left open briefly so the confirmation is actually seen.
        setTimeout(onClose, 1200);
      },
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(32rem,92vw)] rounded-[6px] border border-line p-0 backdrop:bg-ink/40"
      aria-label={`Report incorrect information for ${facilityName}`}
    >
      <form onSubmit={submit} className="p-5">
        <h2 className="text-xl font-semibold text-ink">Report incorrect information</h2>
        <p className="mt-1 text-sm text-muted">{facilityName}</p>

        {mutation.isSuccess ? (
          <p className="mt-5 rounded-[6px] bg-verified-wash p-4 font-medium text-verified">
            Report sent. An administrator will review it.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label="What is wrong?">
              {(p) => (
                <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Tell us more"
              hint="At least 10 characters. Include what you saw and when."
            >
              {(p) => (
                <Textarea
                  {...p}
                  value={description}
                  minLength={10}
                  maxLength={2000}
                  required
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The emergency number rings but nobody answers."
                />
              )}
            </Field>

            {mutation.isError && <ErrorState error={mutation.error} title="Report not sent" />}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {mutation.isSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!mutation.isSuccess && (
            <Button type="submit" disabled={mutation.isPending || description.trim().length < 10}>
              {mutation.isPending ? 'Sending…' : 'Send report'}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
