/**
 * ResQ — authentication state.
 *
 * On mount it tries a silent refresh. If the HttpOnly refresh cookie is still
 * valid the user stays signed in across a reload without the access token ever
 * touching storage.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setAuthLostHandler } from '../api/client.js';
import { authService } from '../services/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setAuthLostHandler(clear);
  }, [clear]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // A 401 here is the normal signed-out case, not an error worth showing.
        const me = await authService.me();
        if (!cancelled) {
          setUser(me.user);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus('anonymous');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((payload) => {
    setAccessToken(payload.tokens.accessToken);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      login: async (credentials) => adopt(await authService.login(credentials)),
      register: async (payload) => adopt(await authService.register(payload)),
      logout: async () => {
        try {
          await authService.logout();
        } finally {
          clear();
        }
      },
      updateUser: setUser,
    }),
    [user, status, adopt, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
