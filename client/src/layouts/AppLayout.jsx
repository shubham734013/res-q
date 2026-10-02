/**
 * ResQ — main shell.
 *
 * Desktop: a single top bar. Mobile: the same nav moves to the bottom, where a
 * thumb can reach it, with Emergency given a dedicated, visually dominant slot
 * (master prompt §34).
 */

import { Link, NavLink, Outlet, useLocation as useRouterLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/search', label: 'Find care' },
  { to: '/saved', label: 'Saved' },
  { to: '/contacts', label: 'Contacts' },
];

function navClass({ isActive }) {
  return `rounded px-3 py-2 text-[15px] font-medium transition-colors ${
    isActive ? 'bg-paper text-ink' : 'text-ink-soft hover:bg-paper'
  }`;
}

export function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname } = useRouterLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-ink">
            ResQ
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/emergency"
              className="rounded-[6px] bg-urgent px-3 py-2 text-[15px] font-semibold text-white hover:bg-urgent-dark"
            >
              Emergency
            </Link>

            {isAuthenticated ? (
              <details className="relative hidden sm:block">
                <summary className="cursor-pointer list-none rounded px-3 py-2 text-[15px] font-medium text-ink-soft hover:bg-paper">
                  {user?.name?.split(' ')[0] ?? 'Account'}
                </summary>
                <div className="absolute right-0 mt-1 w-52 rounded-[6px] border border-line bg-surface p-1 shadow-lg">
                  {user?.role === 'HOSPITAL_ADMIN' || user?.role === 'SUPER_ADMIN' ? (
                    <Link to="/hospital-admin" className="block rounded px-3 py-2 hover:bg-paper">
                      Manage facility
                    </Link>
                  ) : null}
                  {user?.role === 'SUPER_ADMIN' && (
                    <Link to="/admin/reports" className="block rounded px-3 py-2 hover:bg-paper">
                      Review reports
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="block w-full rounded px-3 py-2 text-left hover:bg-paper"
                  >
                    Sign out
                  </button>
                </div>
              </details>
            ) : (
              <Link
                to="/login"
                className="hidden rounded px-3 py-2 text-[15px] font-medium text-ink-soft hover:bg-paper sm:block"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface sm:hidden"
      >
        <ul className="grid grid-cols-4">
          {[{ to: '/search', label: 'Find' }, ...NAV.slice(1)].map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center text-sm font-medium ${
                    isActive ? 'text-signal' : 'text-ink-soft'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <Link
              to="/emergency"
              className={`flex h-16 flex-col items-center justify-center text-sm font-bold ${
                pathname === '/emergency' ? 'bg-urgent-dark text-white' : 'bg-urgent text-white'
              }`}
            >
              Emergency
            </Link>
          </li>
        </ul>
      </nav>

      <footer className="hidden border-t border-line bg-surface py-6 sm:block">
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted">
          <p className="max-w-2xl">
            ResQ helps you find healthcare facilities. It does not diagnose, does not provide
            treatment advice, and cannot reserve a bed or dispatch an ambulance. In a
            life-threatening emergency, contact your local emergency service.
          </p>
        </div>
      </footer>
    </div>
  );
}
