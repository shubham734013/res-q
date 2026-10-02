/**
 * ResQ — sign in and registration.
 *
 * Both forms live here because they are the same shape. Note that no role
 * selector exists: the API refuses a client-supplied role, and offering one in
 * the UI would imply otherwise.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState } from '../components/States.jsx';
import { Button, Field, Input } from '../components/ui/index.jsx';

function useSubmit(action, redirectTo = '/') {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const submit = async (payload) => {
    setPending(true);
    setError(null);
    try {
      await action(payload);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return { submit, error, pending };
}

function Shell({ title, intro, children, footer }) {
  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
      {intro && <p className="mt-1.5 text-ink-soft">{intro}</p>}
      {children}
      <p className="mt-6 text-[15px] text-ink-soft">{footer}</p>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { submit, error, pending } = useSubmit(login);
  const [form, setForm] = useState({ email: '', password: '' });

  return (
    <Shell
      title="Sign in"
      intro="Saving facilities and emergency contacts needs an account. Searching does not."
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="font-medium text-signal underline">
            Create one
          </Link>
        </>
      }
    >
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(form);
        }}
      >
        <Field label="Email" required>
          {(p) => (
            <Input
              {...p}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>

        <Field label="Password" required>
          {(p) => (
            <Input
              {...p}
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>

        {error && <ErrorState error={error} title="Could not sign in" />}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { submit, error, pending } = useSubmit(register);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  return (
    <Shell
      title="Create an account"
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-signal underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit({ ...form, phone: form.phone || undefined });
        }}
      >
        <Field label="Name" required>
          {(p) => (
            <Input
              {...p}
              required
              minLength={2}
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
        </Field>

        <Field label="Email" required>
          {(p) => (
            <Input
              {...p}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>

        <Field label="Phone" hint="Optional. Used only if you ask us to contact you.">
          {(p) => (
            <Input
              {...p}
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          )}
        </Field>

        <Field label="Password" required hint="At least 12 characters. Length beats complexity.">
          {(p) => (
            <Input
              {...p}
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>

        {error && <ErrorState error={error} title="Could not create your account" />}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </Shell>
  );
}
