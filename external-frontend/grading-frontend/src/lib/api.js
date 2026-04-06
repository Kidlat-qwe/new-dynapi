/**
 * Grading API client: base URL from api-backend systems + API token (env or localStorage).
 * Call ensureGradingConfig() on app init so the frontend uses the Grading base URL from the api-backend.
 */

const VITE_API_ORIGIN = import.meta.env.VITE_API_ORIGIN;
const VITE_API_URL = import.meta.env.VITE_API_URL;
const VITE_GRADING_API_TOKEN = import.meta.env.VITE_GRADING_API_TOKEN;

function deriveApiOrigin() {
  if (VITE_API_ORIGIN) return VITE_API_ORIGIN.replace(/\/$/, '');
  const base = VITE_API_URL || 'http://localhost:3000';
  try {
    const u = new URL(base);
    return u.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

const API_ORIGIN = deriveApiOrigin();

/** Default Grading base URL before we fetch from api-backend */
const DEFAULT_GRADING_BASE =
  VITE_API_URL && String(VITE_API_URL).includes('grading')
    ? String(VITE_API_URL).replace(/\/$/, '')
    : `${API_ORIGIN}/api/grading`;

let gradingBaseUrl = DEFAULT_GRADING_BASE;

/**
 * API backend origin (e.g. http://localhost:3000). Used to fetch GET /api/external/systems.
 */
export function getApiOrigin() {
  return API_ORIGIN;
}

/**
 * Current Grading API base URL. Use for all Grading API calls.
 */
export function getGradingBaseUrl() {
  return gradingBaseUrl;
}

export function setGradingBaseUrl(url) {
  if (url && typeof url === 'string') {
    gradingBaseUrl = url.replace(/\/$/, '');
  }
}

/**
 * Token for Authorization: Bearer. Prefer logged-in user token (userToken) so the backend can
 * set req.user for system logs; fall back to API token when no user is logged in.
 */
export function getAuthToken() {
  const userToken = localStorage.getItem('userToken') || '';
  if (userToken.trim()) return userToken.trim();
  const fromEnv =
    typeof VITE_GRADING_API_TOKEN === 'string' && VITE_GRADING_API_TOKEN.trim()
      ? VITE_GRADING_API_TOKEN.trim()
      : '';
  return fromEnv || localStorage.getItem('grading_api_token') || '';
}

/**
 * Logged-in user email from userData (when user is logged in). Used for X-User-Email header
 * so the backend can log the actual user in system_request_log.
 */
export function getLoggedInUserEmail() {
  try {
    const raw = localStorage.getItem('userData');
    if (!raw) return '';
    const data = JSON.parse(raw);
    const email = data?.email || data?.username || '';
    return typeof email === 'string' && email.includes('@') ? email.trim() : '';
  } catch {
    return '';
  }
}

/** Message shown when API token is not configured. */
export const API_TOKEN_REQUIRED_MESSAGE =
  'API token required. Add VITE_GRADING_API_TOKEN to your .env file. Get your token from the API system Admin > API Tokens.';

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
  const fromEnv =
    typeof VITE_GRADING_API_TOKEN === 'string' && VITE_GRADING_API_TOKEN.trim()
      ? VITE_GRADING_API_TOKEN.trim()
      : '';
  const fromStorage = localStorage.getItem('grading_api_token') || '';
  const token = fromEnv || fromStorage;
  return token && String(token).startsWith('sk_') ? token : '';
}

export function setApiToken(token) {
  if (token != null) {
    localStorage.setItem('grading_api_token', token);
  } else {
    localStorage.removeItem('grading_api_token');
  }
}

/**
 * Fetch systems from api-backend and set Grading base_url. Call once on app init.
 */
export async function ensureGradingConfig() {
  try {
    const res = await fetch(`${API_ORIGIN}/api/external/systems`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return getGradingBaseUrl();
    const data = await res.json();
    const systems = data.systems || [];
    const grading = systems.find(
      (s) => (s.api_path_slug || '').toLowerCase() === 'grading'
    );
    if (grading && grading.base_url) {
      setGradingBaseUrl(grading.base_url);
      return grading.base_url;
    }
  } catch (err) {
    console.warn('Grading config: could not fetch systems from api-backend', err);
  }
  return getGradingBaseUrl();
}

/**
 * Normalize path: backend has /users, /school-years, etc. (no /api prefix). Frontend often uses /api/school-years.
 */
export function normalizeGradingPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (p.startsWith('/api/')) return p.slice(4); // /api/school-years -> /school-years
  return p;
}

/**
 * Full URL for a Grading API path (for use with axios). Path is normalized (e.g. /api/school-years -> /school-years).
 */
export function gradingUrl(path) {
  const base = getGradingBaseUrl().replace(/\/$/, '');
  return `${base}${normalizeGradingPath(path)}`;
}

/**
 * Auth header for Grading requests (for use with axios). Includes X-API-Key when API token is set so api-backend counts usage.
 * Adds X-User-Email when user is logged in so system logs show the actual user.
 * Note: fetchGrading blocks when API token is not configured; axios users should check isApiTokenConfigured() before calling.
 */
export function getAuthHeader() {
  const token = getAuthToken();
  const apiToken = getApiTokenForCounting();
  const userEmail = getLoggedInUserEmail();
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (apiToken) h['X-API-Key'] = apiToken;
  if (userEmail) h['X-User-Email'] = userEmail;
  return h;
}

/**
 * Authenticated fetch to Grading API. Path can be /users/... or /api/school-years (will be normalized).
 * Adds Authorization: Bearer <token> when getAuthToken() is set. Use skipAuth: true for public routes if needed.
 * Requires API token (VITE_GRADING_API_TOKEN) to be configured; otherwise rejects.
 */
export async function fetchGrading(path, options = {}) {
  const { skipAuth = false, ...restOptions } = options;
  if (!isApiTokenConfigured()) {
    const err = new Error(API_TOKEN_REQUIRED_MESSAGE);
    console.error('[Grading API]', API_TOKEN_REQUIRED_MESSAGE, err);
    return Promise.reject(err);
  }
  const base = getGradingBaseUrl();
  const normalized = normalizeGradingPath(path);
  const url = `${base.replace(/\/$/, '')}${normalized}`;
  const token = skipAuth ? '' : getAuthToken();
  const apiToken = getApiTokenForCounting();
  const userEmail = getLoggedInUserEmail();
  const headers = { ...(restOptions.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiToken) headers['X-API-Key'] = apiToken;
  if (userEmail) headers['X-User-Email'] = userEmail;
  return fetch(url, { ...restOptions, headers });
}
