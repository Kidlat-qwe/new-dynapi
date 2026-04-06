/**
 * Resolves CMS API base URL for requests through the API gateway.
 * Default: VITE_API_ORIGIN + /api/cms. Optional: GET /api/external/systems for registry base_url.
 */

function deriveApiOrigin() {
  const explicit = import.meta.env.VITE_API_ORIGIN;
  if (explicit) return String(explicit).replace(/\/$/, '');
  const legacyBase = import.meta.env.VITE_API_BASE_URL || '';
  if (legacyBase) {
    try {
      return new URL(legacyBase).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location?.origin || '')) {
    return 'http://localhost:3000';
  }
  return '';
}

const API_ORIGIN = deriveApiOrigin();

let _cmsBaseUrl = API_ORIGIN ? `${API_ORIGIN}/api/cms` : '/api/cms';
let _configured = false;

export async function ensureCmsConfig() {
  if (_configured) return _cmsBaseUrl;
  const origin = API_ORIGIN.replace(/\/$/, '');
  if (!origin) {
    _configured = true;
    return _cmsBaseUrl;
  }
  try {
    const res = await fetch(`${origin}/api/external/systems`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { systems } = await res.json();
    const cms = systems?.find(
      (s) => s.api_path_slug === 'cms' || String(s.system_name || '').toLowerCase().includes('cms')
    );
    if (cms?.base_url) {
      _cmsBaseUrl = String(cms.base_url).replace(/\/$/, '');
    }
  } catch (err) {
    console.warn('[CMS] Using default API base:', _cmsBaseUrl, err?.message || err);
  }
  _configured = true;
  return _cmsBaseUrl;
}

export function getCmsBaseUrl() {
  return _cmsBaseUrl;
}
