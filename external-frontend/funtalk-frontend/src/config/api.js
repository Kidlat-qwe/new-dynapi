/**
 * API base URL.
 * - Dev: local backend (or VITE_API_BASE_URL).
 * - Prod: VITE_API_BASE_URL when it matches the page host; otherwise same-origin `/api`.
 *
 * This avoids broken calls when the build sets e.g. `http://funtalk-appointment.com/api`
 * but the user opens the app via `http://139.162.27.191` (DNS / hosts not ready everywhere).
 */
function resolveApiBase() {
  const env = import.meta.env.VITE_API_BASE_URL?.trim();

  if (import.meta.env.DEV) {
    return env || 'http://localhost:3000/api';
  }

  if (!env) {
    return '/api';
  }

  if (typeof window === 'undefined') {
    return env;
  }

  try {
    const u = new URL(env);
    if (u.hostname !== window.location.hostname) {
      return `${window.location.origin}/api`;
    }
  } catch {
    return env;
  }

  return env;
}

export const API_BASE_URL = resolveApiBase();
