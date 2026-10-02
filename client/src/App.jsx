import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LocationProvider } from './context/LocationContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';

import { LandingPage } from './pages/Landing.jsx';
import { SearchPage } from './pages/Search.jsx';
import { FacilityDetailPage } from './pages/FacilityDetail.jsx';
import { EmergencyPage } from './pages/Emergency.jsx';
import { SavedPage } from './pages/Saved.jsx';
import { ContactsPage } from './pages/Contacts.jsx';
import { LoginPage, RegisterPage } from './pages/Auth.jsx';

import { NotFoundPage } from './pages/NotFound.jsx';
import { Spinner } from './components/ui/index.jsx';

// Admin screens are opened by a small minority of users; keep them out of the
// bundle everyone downloads.
const HospitalAdminPage = lazy(() =>
  import('./pages/HospitalAdmin.jsx').then((m) => ({ default: m.HospitalAdminPage })),
);
const AdminReportsPage = lazy(() =>
  import('./pages/AdminReports.jsx').then((m) => ({ default: m.AdminReportsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Availability goes stale quickly and the freshness label would lie if we
      // served a cached page for minutes. Short stale time, refetch on focus.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => error?.isRetryable !== false && failureCount < 2,
    },
  },
});

function RequireAuth({ children, roles }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <Spinner label="Loading" />
                </div>
              }
            >
            <Routes>
              {/* Emergency Mode sits outside the standard shell: it has its own
                  stripped-back chrome and must not inherit the normal nav. */}
              <Route path="/emergency" element={<EmergencyPage />} />

              <Route element={<AppLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/facility/:id" element={<FacilityDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route
                  path="/saved"
                  element={
                    <RequireAuth>
                      <SavedPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/contacts"
                  element={
                    <RequireAuth>
                      <ContactsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/hospital-admin"
                  element={
                    <RequireAuth roles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']}>
                      <HospitalAdminPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <RequireAuth roles={['SUPER_ADMIN']}>
                      <AdminReportsPage />
                    </RequireAuth>
                  }
                />

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            </Suspense>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
