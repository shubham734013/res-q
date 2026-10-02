/**
 * ResQ — location state (TDD §10.1–10.2).
 *
 * Geolocation is requested, never required. A denial moves the user to manual
 * entry rather than blocking the app, because "the application must not require
 * location access for every feature".
 *
 * Only a manually chosen location is persisted, and only the city label plus
 * coordinates. A GPS fix is kept in memory for the session and nowhere else.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LocationContext = createContext(null);
const STORAGE_KEY = 'resq.manualLocation';

/** A small set so the prototype works without a geocoding provider or API key. */
export const KNOWN_PLACES = [
  { label: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { label: 'Jaipur — Mansarovar', lat: 26.8505, lng: 75.7628 },
  { label: 'Jaipur — Vaishali Nagar', lat: 26.9115, lng: 75.739 },
  { label: 'Delhi — Connaught Place', lat: 28.6315, lng: 77.2167 },
  { label: 'Delhi — Saket', lat: 28.5245, lng: 77.2066 },
  { label: 'Delhi — Rohini', lat: 28.741, lng: 77.066 },
];

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number' ? parsed : null;
  } catch {
    // Private browsing, blocked storage, or corrupted JSON. Not an error worth
    // surfacing — the app simply starts without a remembered location.
    return null;
  }
}

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => readStored());
  // Derived at init rather than in an effect: nothing external changes it.
  const [permission, setPermission] = useState(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported',
  ); // prompt | granted | denied | unsupported
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState(null);

  const requestPrecise = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported');
      setError('This browser cannot share your location. Choose an area instead.');
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: 'Your current location',
          isPrecise: true,
        });
        setPermission('granted');
        setIsLocating(false);
      },
      (err) => {
        setPermission(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt');
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is off. Choose an area below to keep searching.'
            : 'Could not get your location. Choose an area below instead.',
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const setManual = useCallback((place) => {
    const next = { ...place, isPrecise: false };
    setLocation(next);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Remembering the choice is a convenience; failing to do so is harmless.
    }
  }, []);

  const value = useMemo(
    () => ({
      location,
      permission,
      isLocating,
      error,
      hasLocation: location != null,
      requestPrecise,
      setManual,
      clear: () => {
        setLocation(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      },
    }),
    [location, permission, isLocating, error, requestPrecise, setManual],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}
