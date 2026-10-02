/**
 * ResQ — location control.
 *
 * Doubles as the landing hero: the first thing on the page is the thing you
 * came to do. Geolocation is offered, never demanded, and the manual list is
 * always visible rather than hidden behind a denial (TDD §10.2).
 */

import { KNOWN_PLACES, useLocation } from '../context/LocationContext.jsx';
import { Button, Select } from './ui/index.jsx';

export function LocationPicker({ compact = false }) {
  const { location, requestPrecise, setManual, isLocating, error, permission } = useLocation();

  const onPick = (event) => {
    const place = KNOWN_PLACES.find((p) => p.label === event.target.value);
    if (place) setManual(place);
  };

  return (
    <div className={compact ? '' : 'rounded-[6px] border border-line bg-surface p-4 sm:p-5'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="area-select"
            className="mb-1.5 block text-sm font-semibold text-ink-soft"
          >
            Search near
          </label>
          <Select
            id="area-select"
            value={location?.isPrecise ? '' : (location?.label ?? '')}
            onChange={onPick}
          >
            <option value="" disabled>
              {location?.isPrecise ? 'Using your current location' : 'Choose an area'}
            </option>
            {KNOWN_PLACES.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        <Button
          variant="secondary"
          onClick={requestPrecise}
          disabled={isLocating}
          className="sm:w-auto"
        >
          {isLocating ? 'Finding you…' : 'Use my location'}
        </Button>
      </div>

      {location && (
        <p className="mt-2 text-sm text-muted">
          Searching from <span className="font-medium text-ink-soft">{location.label}</span>
          {location.isPrecise && ' — kept for this session only'}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-caution">{error}</p>}

      {permission === 'denied' && !error && (
        <p className="mt-2 text-sm text-muted">
          Location access is off. Choosing an area works just as well.
        </p>
      )}
    </div>
  );
}
