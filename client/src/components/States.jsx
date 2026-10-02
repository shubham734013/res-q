/**
 * ResQ — loading, empty and error states.
 *
 * Empty screens say what to do next; errors say what happened and how to fix
 * it. Neither apologises, and neither is vague.
 */

import { Button } from './ui/index.jsx';

export function FacilitySkeleton({ count = 4 }) {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-label="Loading results">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex gap-3 py-4">
          <span className="skeleton w-1 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-5 w-1/2 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-[6px] border border-dashed border-line bg-surface px-5 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Error display. Note the absence of red: --urgent belongs to the emergency
 * path alone, so a failed request is rendered in ink.
 */
export function ErrorState({ error, onRetry, title = 'That did not load' }) {
  const message = error?.message ?? 'Something went wrong.';
  const details = error?.details ?? [];

  return (
    <div className="rounded-[6px] border border-line bg-surface p-5">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-ink-soft">{message}</p>

      {details.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-soft">
          {details.map((d, i) => (
            <li key={i}>
              <span className="font-medium">{d.path}</span>: {d.message}
            </li>
          ))}
        </ul>
      )}

      {onRetry && error?.isRetryable !== false && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}

      {error?.requestId && (
        <p className="mt-3 text-xs text-muted">
          Reference <span className="tnum">{error.requestId}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Shown whenever any listing on screen came from the seed script. Visible at
 * the top of the content, not tucked in a footer — a demo must never be
 * mistaken for live information (master prompt §68).
 */
export function DemoDataNotice({ className = '' }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-[6px] border border-signal/30 bg-signal-wash px-3 py-2 text-sm text-ink-soft ${className}`}
    >
      <span className="mt-0.5 font-bold text-signal" aria-hidden="true">
        ⓘ
      </span>
      <span>
        <span className="font-semibold text-ink">Demo data.</span> These facilities and their
        availability are seeded examples, not real listings.
      </span>
    </p>
  );
}
