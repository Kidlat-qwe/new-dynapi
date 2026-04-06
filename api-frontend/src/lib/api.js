/**
 * API client helpers. Uses VITE_API_URL (default http://localhost:3000).
 */

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Call backend with Firebase ID token in Authorization header.
 * @param {string} path - Path without base (e.g. '/api/users/sync')
 * @param {RequestInit & { body?: object }} options - fetch options; body can be object (JSON).
 * @param {string} idToken - Firebase ID token
 */
export async function fetchWithToken(path, options = {}, idToken) {
  const { body, ...rest } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'Request failed');
    err.status = res.status;
    let data;
    try {
      data = await res.json();
      err.message = data.error || data.message || err.message;
    } catch {
      err.message = (await res.text()) || err.message;
    }
    throw err;
  }
  return res.json();
}
