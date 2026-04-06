/**
 * Funtalk API client: base URL from api-backend systems + auth token (API token or JWT).
 * Call ensureFuntalkConfig() on app init so the frontend uses the Funtalk base URL from the api-backend.
 */

const VITE_API_ORIGIN = import.meta.env.VITE_API_ORIGIN;
const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
/** API token from env (e.g. .env: VITE_FUNTALK_API_TOKEN=sk_xxx). Used for all Funtalk requests when set. */
const VITE_FUNTALK_API_TOKEN = import.meta.env.VITE_FUNTALK_API_TOKEN;

function deriveApiOrigin() {
  if (VITE_API_ORIGIN) return VITE_API_ORIGIN.replace(/\/$/, '');
  const base = VITE_API_BASE_URL || 'http://localhost:3000/api';
  try {
    const u = new URL(base);
    return u.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

const API_ORIGIN = deriveApiOrigin();

/** Default Funtalk base URL before we fetch from api-backend (env or origin + /api/funtalk) */
const DEFAULT_FUNTALK_BASE =
  VITE_API_BASE_URL && String(VITE_API_BASE_URL).includes('funtalk')
    ? String(VITE_API_BASE_URL).replace(/\/$/, '')
    : `${API_ORIGIN}/api/funtalk`;

let funtalkBaseUrl = DEFAULT_FUNTALK_BASE;

/**
 * API backend origin (e.g. http://localhost:3000). Used to fetch GET /api/external/systems.
 */
export function getApiOrigin() {
  return API_ORIGIN;
}

/**
 * Current Funtalk API base URL (stored from api-backend or env). Use for all Funtalk API calls.
 */
export function getFuntalkBaseUrl() {
  return funtalkBaseUrl;
}

/**
 * Server origin for static/file URLs (e.g. uploads). Derived from Funtalk base URL.
 */
export function getFuntalkServerOrigin() {
  try {
    return new URL(funtalkBaseUrl).origin;
  } catch {
    return API_ORIGIN;
  }
}

/**
 * Set Funtalk base URL (e.g. after fetching from GET /api/external/systems).
 */
export function setFuntalkBaseUrl(url) {
  if (url && typeof url === 'string') {
    funtalkBaseUrl = url.replace(/\/$/, '');
  }
}

/**
 * Logged-in user email from localStorage 'user' (when user is logged in). Used for X-User-Email header
 * so the backend can log the actual user in system_request_log.
 */
export function getLoggedInUserEmail() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const data = JSON.parse(raw);
    const email = data?.email || '';
    return typeof email === 'string' && email.includes('@') ? email.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Token for Authorization: Bearer. Prefer logged-in user token (token from login) so the backend can
 * set req.user for system logs; fall back to API token when no user is logged in.
 */
export function getAuthToken() {
  const userToken = localStorage.getItem('token') || '';
  if (userToken.trim()) return userToken.trim();
  const fromEnv = typeof VITE_FUNTALK_API_TOKEN === 'string' && VITE_FUNTALK_API_TOKEN.trim()
    ? VITE_FUNTALK_API_TOKEN.trim()
    : '';
  return fromEnv || localStorage.getItem('funtalk_api_token') || '';
}

/** Message shown when API token is not configured. */
export const API_TOKEN_REQUIRED_MESSAGE =
  'API token required. Add VITE_FUNTALK_API_TOKEN to your .env file. Get your token from the API system Admin > API Tokens.';

/**
 * Returns true if a valid API token (sk_xxx) is configured (env or localStorage).
 * When false, data fetches are blocked.
 */
export function isApiTokenConfigured() {
  return !!getApiTokenForCounting();
}

/**
 * API token only (sk_xxx from env or localStorage). Send as X-API-Key on every request so api-backend can count usage.
 */
export function getApiTokenForCounting() {
  const fromEnv = typeof VITE_FUNTALK_API_TOKEN === 'string' && VITE_FUNTALK_API_TOKEN.trim()
    ? VITE_FUNTALK_API_TOKEN.trim()
    : '';
  const fromStorage = localStorage.getItem('funtalk_api_token') || '';
  const token = fromEnv || fromStorage;
  return token && String(token).startsWith('sk_') ? token : '';
}

/**
 * Store API token so all Funtalk requests use it. Optional; if not set, JWT from login is used.
 */
export function setApiToken(token) {
  if (token != null) {
    localStorage.setItem('funtalk_api_token', token);
  } else {
    localStorage.removeItem('funtalk_api_token');
  }
}

/**
 * Fetch systems from api-backend and set Funtalk base_url so the frontend uses the correct URL.
 * Call once on app init (e.g. in App.jsx).
 */
export async function ensureFuntalkConfig() {
  try {
    const res = await fetch(`${API_ORIGIN}/api/external/systems`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const systems = data.systems || [];
    const funtalk = systems.find(
      (s) => (s.api_path_slug || '').toLowerCase() === 'funtalk'
    );
    if (funtalk && funtalk.base_url) {
      setFuntalkBaseUrl(funtalk.base_url);
      return funtalk.base_url;
    }
  } catch (err) {
    console.warn('Funtalk config: could not fetch systems from api-backend', err);
  }
  return getFuntalkBaseUrl();
}

/**
 * Authenticated fetch to Funtalk API. Path must start with /.
 * Adds Authorization: Bearer <token> when getAuthToken() is set, unless options.skipAuth is true.
 * Use skipAuth: true for public auth routes (e.g. /auth/login, /auth/register) so the backend
 * only receives the body (e.g. firebaseToken) and does not see an API token.
 * Requires API token (VITE_FUNTALK_API_TOKEN) to be configured; otherwise rejects.
 */
export async function fetchFuntalk(path, options = {}) {
  const { skipAuth = false, ...restOptions } = options;
  if (!isApiTokenConfigured()) {
    const err = new Error(API_TOKEN_REQUIRED_MESSAGE);
    console.error('[Funtalk API]', API_TOKEN_REQUIRED_MESSAGE, err);
    return Promise.reject(err);
  }
  const base = getFuntalkBaseUrl();
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const token = skipAuth ? '' : getAuthToken();
  const apiToken = getApiTokenForCounting();
  const userEmail = getLoggedInUserEmail();
  const headers = {
    ...(restOptions.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (apiToken) {
    headers['X-API-Key'] = apiToken;
  }
  if (userEmail) {
    headers['X-User-Email'] = userEmail;
  }
  return fetch(url, { ...restOptions, headers });
}
