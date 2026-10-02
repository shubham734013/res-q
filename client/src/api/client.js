/**
 * ResQ — HTTP client.
 *
 * One place that knows about the { success, data } / { success, error }
 * envelope, about the access token, and about refreshing it. Callers get back
 * `data` or a thrown ApiError, so no component has to unwrap an envelope.
 */

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor({ code, message, details, status, requestId }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
    this.requestId = requestId;
  }

  /** True when retrying could plausibly help. Drives the "Try again" button. */
  get isRetryable() {
    return this.status >= 500 || this.code === 'RATE_LIMITED' || this.code === 'NETWORK';
  }
}

// Held in memory only. Putting the access token in localStorage would expose it
// to any XSS on the page; the refresh token is an HttpOnly cookie the JS here
// cannot read at all.
let accessToken = null;
let onAuthLost = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setAuthLostHandler = (fn) => {
  onAuthLost = fn;
};

let refreshInFlight = null;

async function refreshAccessToken() {
  // Collapse concurrent 401s into a single refresh, otherwise a page that
  // fires four queries at once rotates the refresh token four times and the
  // reuse detector revokes the whole session.
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
      });
      if (!res.ok) return null;
      const body = await res.json();
      const token = body?.data?.tokens?.accessToken ?? null;
      accessToken = token;
      return token;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

async function parse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // A non-JSON response means a proxy or crash, not an API error.
  }

  if (res.ok && body?.success) return body.data;

  throw new ApiError({
    code: body?.error?.code ?? 'INTERNAL_ERROR',
    message: body?.error?.message ?? `Request failed (${res.status})`,
    details: body?.error?.details,
    status: res.status,
    requestId: body?.requestId,
  });
}

export async function request(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      code: 'NETWORK',
      message: 'Could not reach the server. Check your connection and try again.',
      status: 0,
    });
  }

  if (res.status === 401 && auth && retry) {
    const token = await refreshAccessToken();
    if (token) return request(path, { method, body, auth, retry: false });
    onAuthLost();
  }

  return parse(res);
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

/** Builds a query string, dropping undefined/null/'' so filters stay clean. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
