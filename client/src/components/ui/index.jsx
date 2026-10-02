/**
 * ResQ — base UI primitives.
 *
 * Kept in one file because they are small and always imported together.
 * Anything with real behaviour gets its own file.
 */

import { forwardRef, useId } from 'react';

const BUTTON_VARIANTS = {
  primary: 'bg-signal text-white hover:bg-signal-dark disabled:bg-muted',
  // Reserved for emergency affordances. See the note in index.css.
  urgent: 'bg-urgent text-white hover:bg-urgent-dark disabled:bg-muted',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-paper',
  ghost: 'bg-transparent text-ink-soft hover:bg-paper',
};

const BUTTON_SIZES = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  // Emergency controls get oversized touch targets (master prompt §49).
  lg: 'h-14 px-6 text-lg',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', as: Tag = 'button', ...props },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-[6px] font-semibold
        transition-colors disabled:cursor-not-allowed
        ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
});

export function Field({ label, hint, error, children, required }) {
  const id = useId();
  const child =
    typeof children === 'function'
      ? children({ id, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined })
      : children;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
        {required && <span className="text-muted"> (required)</span>}
      </label>
      {child}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm font-medium text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'h-11 w-full rounded-[6px] border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted';

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`${CONTROL} ${className}`} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`min-h-28 w-full rounded-[6px] border border-line bg-surface p-3 text-[15px] ${className}`}
      {...props}
    />
  );
});

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[6px] border border-line bg-surface ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-2 text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-signal" />
    </span>
  );
}
