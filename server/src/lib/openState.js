/**
 * ResQ — "open now" evaluation.
 *
 * Returns UNKNOWN rather than guessing. A facility with no recorded hours is
 * not "closed", and showing it as closed during an emergency would be a
 * dangerous fabrication.
 */

/**
 * @param {Array<{dayOfWeek:number, openTime:string|null, closeTime:string|null,
 *                isClosed:boolean, is24Hours:boolean}>} hours
 * @param {Date} [now]
 * @returns {'OPEN'|'CLOSED'|'UNKNOWN'}
 */
export function evaluateOpenState(hours, now = new Date()) {
  if (!hours || hours.length === 0) return 'UNKNOWN';

  const day = now.getDay(); // 0 = Sunday, matching OperatingHour.dayOfWeek
  const today = hours.find((h) => h.dayOfWeek === day);
  if (!today) return 'UNKNOWN';

  if (today.is24Hours) return 'OPEN';
  if (today.isClosed) return 'CLOSED';
  if (!today.openTime || !today.closeTime) return 'UNKNOWN';

  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = toMinutes(today.openTime);
  const close = toMinutes(today.closeTime);
  if (open == null || close == null) return 'UNKNOWN';

  // A close time at or before the open time means the window crosses midnight
  // (e.g. 20:00–02:00). Treating that as an empty window would wrongly mark
  // every night-shift clinic closed.
  if (close <= open) {
    return minutes >= open || minutes < close ? 'OPEN' : 'CLOSED';
  }

  return minutes >= open && minutes < close ? 'OPEN' : 'CLOSED';
}

function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
