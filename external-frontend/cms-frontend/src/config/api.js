/**
 * CMS frontend → API gateway (api-backend) at /api/cms.
 *
 * Env:
 * - VITE_API_ORIGIN — api-backend origin (e.g. http://localhost:3000)
 * - VITE_CMS_API_TOKEN — required sk_ token from API Admin → API tokens (system: cms)
 */
import { getCmsBaseUrl } from '../lib/api.js';

const CMS_API_TOKEN = import.meta.env.VITE_CMS_API_TOKEN || '';

/** Default export: string-like object for `${API_BASE_URL}/path` templates */
const API_BASE_URL = {
  toString: () => getCmsBaseUrl(),
};

export default API_BASE_URL;

/**
 * Firebase ID token for Authorization: Bearer (JWT from Firebase Auth only).
 * Never use VITE_CMS_API_TOKEN here — that value is sk_… and must only be sent as X-API-Key;
 * sending sk_ as Bearer makes verifyIdToken fail with "Invalid or expired token".
 */
export function getCmsAuthToken() {
  const userToken = localStorage.getItem('firebase_token') || '';
  return userToken.trim() || null;
}

export function getLoggedInUserEmail() {
  try {
    const token = localStorage.getItem('firebase_token');
    if (!token || !token.includes('.')) return '';
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    const email = payload.email || '';
    return typeof email === 'string' && email.includes('@') ? email.trim() : '';
  } catch {
    return '';
  }
}

export function getCmsApiTokenForCounting() {
  const t = typeof CMS_API_TOKEN === 'string' && CMS_API_TOKEN.trim() ? CMS_API_TOKEN.trim() : '';
  return t && t.startsWith('sk_') ? t : '';
}

export const CMS_API_TOKEN_REQUIRED_MESSAGE =
  'API token required. Add VITE_CMS_API_TOKEN to your .env file. Get your token from the API system Admin > API Tokens.';

export function isCmsApiTokenConfigured() {
  return !!getCmsApiTokenForCounting();
}

/** Headers for apiRequest and raw fetch (PDF, uploads). Includes X-API-Key for gateway counting. */
export function getCmsAuthHeader() {
  const token = getCmsAuthToken();
  const apiToken = getCmsApiTokenForCounting();
  const userEmail = getLoggedInUserEmail();
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (apiToken) h['X-API-Key'] = apiToken;
  if (userEmail) h['X-User-Email'] = userEmail;
  return h;
}

/** Alias for spreading into fetch(); do not set Content-Type for FormData. */
export function getCmsFetchHeaders(extra = {}) {
  return { ...getCmsAuthHeader(), ...extra };
}

function isAuthOnlyEndpoint(endpoint) {
  const path = String(endpoint).split('?')[0];
  return path === '/auth/verify' || path.startsWith('/auth/');
}

export const apiRequest = async (endpoint, options = {}, tokenOverride = null) => {
  if (!isCmsApiTokenConfigured() && !isAuthOnlyEndpoint(endpoint)) {
    const err = new Error(CMS_API_TOKEN_REQUIRED_MESSAGE);
    console.error('[CMS API]', CMS_API_TOKEN_REQUIRED_MESSAGE, err);
    throw err;
  }

  const token = tokenOverride ?? getCmsAuthToken();
  const baseUrl = getCmsBaseUrl();
  const apiToken = getCmsApiTokenForCounting();

  const defaultHeaders = {};

  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  if (apiToken) {
    defaultHeaders['X-API-Key'] = apiToken;
  }
  const userEmail = getLoggedInUserEmail();
  if (userEmail) {
    defaultHeaders['X-User-Email'] = userEmail;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (
    config.body &&
    typeof config.body === 'object' &&
    !(config.body instanceof FormData) &&
    !(config.body instanceof Blob) &&
    config.body.constructor === Object &&
    ['POST', 'PUT', 'PATCH'].includes(config.method?.toUpperCase() || '')
  ) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'An error occurred');
      error.response = { data, status: response.status };
      throw error;
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};
