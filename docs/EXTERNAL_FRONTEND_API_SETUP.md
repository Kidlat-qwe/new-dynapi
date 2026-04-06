# External Frontend → API Backend Setup

This document describes how each **external frontend** (Funtalk, Grading, CMS) is configured to call its **designated external backend** through the **api-backend**. Use it for onboarding, debugging, or adding a new external system.

---

## 1. Overview

- The **api-backend** runs on a single port (e.g. `http://localhost:3000`) and **mounts** each external backend in-process at a fixed path:
  - **Funtalk** → `/api/funtalk`
  - **Grading** → `/api/grading`
  - **CMS** → `/api/cms`
- Each **external frontend** is a separate Vite/React app. It must:
  1. Know the **api-backend origin** (e.g. `http://localhost:3000`).
  2. Resolve its **API base URL** (e.g. `http://localhost:3000/api/cms`) — either from env or by calling the api-backend’s **systems registry**.
  3. Send **auth** (API token and/or Firebase/JWT) with requests as required by the backend.
- The api-backend exposes **GET /api/external/systems**, which returns the list of systems and their `base_url` (e.g. `http://localhost:3000/api/funtalk`). Frontends can call this once on app init to get the correct base URL regardless of deployment.

---

## 2. Systems Registry

**Endpoint:** `GET /api/external/systems`  
**Auth:** None required.

**Response shape:**

```json
{
  "systems": [
    {
      "system_id": 1,
      "system_name": "Funtalk",
      "api_path_slug": "funtalk",
      "base_url": "http://localhost:3000/api/funtalk",
      "is_active": true
    },
    {
      "system_id": 2,
      "system_name": "Grading",
      "api_path_slug": "grading",
      "base_url": "http://localhost:3000/api/grading",
      "is_active": true
    },
    {
      "system_id": 3,
      "system_name": "CMS",
      "api_path_slug": "cms",
      "base_url": "http://localhost:3000/api/cms",
      "is_active": true
    }
  ]
}
```

Frontends use `api_path_slug` or `system_name` to find their system and then use `base_url` for all API calls. If the request fails (e.g. api-backend not running), each frontend falls back to a default URL derived from its env (e.g. `VITE_API_ORIGIN + '/api/cms'`).

---

## 3. Gateway Auth (api-backend)

Before a request reaches an external backend, the api-backend may require or optionally accept an **API token** (Bearer `sk_xxx`):

| System   | Middleware                         | Behavior |
|----------|------------------------------------|----------|
| Funtalk  | `optionalApiTokenForSystem('funtalk')`  | If Bearer is a valid API token for Funtalk → set `req.apiToken` and skip backend auth. Otherwise forward the request (e.g. JWT/Firebase validated by Funtalk backend). |
| Grading  | `requireApiTokenForSystem('grading')`   | Request **must** include a valid API token for Grading. No token → 401. |
| CMS      | `optionalApiTokenForSystem('cms')`     | Same as Funtalk: API token accepted; otherwise forward (e.g. Firebase ID token validated by CMS backend). |

So:

- **Grading frontend** must have an API token (env or from login) for every request.
- **Funtalk** and **CMS** can use either an API token or their own auth (JWT/Firebase); the backend then validates the forwarded token.

**Request counting (Admin > API tokens):** The api-backend counts every request that includes a valid API token (`Bearer sk_xxx` or `X-API-Key: sk_xxx`) and updates **Total requests** and **Avg response time** on the API tokens page. Each external frontend sends the API token (from env or localStorage) as `X-API-Key` when configured, so that browsing and clicking in the app is counted. Ensure `VITE_GRADING_API_TOKEN`, `VITE_CMS_API_TOKEN`, or `VITE_FUNTALK_API_TOKEN` is set in the frontend env when you want usage to be attributed to that token.

---

## 4. Per-Frontend Setup

### 4.1 Funtalk Frontend

**Repo path:** `external-frontend/funtalk-frontend/`

**API client:** `src/lib/api.js`

| Purpose | Function / export | Notes |
|--------|--------------------|--------|
| Bootstrap | `ensureFuntalkConfig()` | Call once on app init. Fetches `/api/external/systems`, finds `api_path_slug === 'funtalk'`, sets internal base URL. |
| Base URL | `getFuntalkBaseUrl()` | Use for all Funtalk API calls. |
| Auth token | `getAuthToken()` | Order: `VITE_FUNTALK_API_TOKEN` → `localStorage.funtalk_api_token` → `localStorage.token`. |
| Fetch | `fetchFuntalk(path, options)` | Builds URL from base + path, adds `Authorization: Bearer <token>` unless `options.skipAuth === true`. Use `skipAuth: true` for login/register. |

**Bootstrap:** Call `ensureFuntalkConfig()` in `App.jsx` (or root) on mount, e.g. in `useEffect`.

**Env (`.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_ORIGIN` | Recommended | api-backend origin, e.g. `http://localhost:3000` (no trailing slash). |
| `VITE_API_BASE_URL` | Optional | Override full base URL (e.g. `http://localhost:3000/api/funtalk`) if not using systems registry. |
| `VITE_FUNTALK_API_TOKEN` | Optional | API token for Funtalk. If set, used for all requests; otherwise JWT from login is used. |

**Backend auth:** Funtalk backend accepts either gateway API token (`req.apiToken`) or validates JWT/Firebase itself.

---

### 4.2 Grading Frontend

**Repo path:** `external-frontend/grading-frontend/`

**API client:** `src/lib/api.js`

| Purpose | Function / export | Notes |
|--------|--------------------|--------|
| Bootstrap | `ensureGradingConfig()` | Call once on app init. Fetches systems, finds `grading`, sets base URL. |
| Base URL | `getGradingBaseUrl()` | Use for all Grading API calls. |
| Path norm | `normalizeGradingPath(path)` | Strips leading `/api/` if present (backend routes have no `/api` prefix). |
| Full URL | `gradingUrl(path)` | `getGradingBaseUrl() + normalizeGradingPath(path)` — use with axios. |
| Auth token | `getAuthToken()`, `setApiToken(token)` | Token from `VITE_GRADING_API_TOKEN` → `grading_api_token` → `userToken`. |
| Auth header | `getAuthHeader()` | `{ Authorization: 'Bearer <token>' }` or `{}` — for axios. |
| Fetch | `fetchGrading(path, options)` | Normalizes path, adds Bearer token unless `options.skipAuth === true`. |

**Bootstrap:** Call `ensureGradingConfig()` once on app init (e.g. in `App.jsx` or main entry).

**Env (`.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_ORIGIN` | Recommended | api-backend origin, e.g. `http://localhost:3000`. |
| `VITE_API_URL` | Optional | Full Grading base URL if not using systems registry. |
| `VITE_GRADING_API_TOKEN` | Yes (when using api-backend) | API token for Grading system. Create in api-backend Admin → API tokens for system "grading". |

**Backend auth:** Grading routes are behind `requireApiTokenForSystem('grading')`; every request must send a valid API token. The frontend may also use backend login (username/password → JWT) and store that JWT; the gateway still expects a valid Grading API token for the request.

---

### 4.3 CMS Frontend

**Repo path:** `external-frontend/cms-frontend/`

**API client:** `src/lib/api.js` (bootstrap) + `src/config/api.js` (request helper + auth).

| Purpose | Function / export | Notes |
|--------|--------------------|--------|
| Bootstrap | `ensureCmsConfig()` | Call once on app init. Fetches `/api/external/systems`, finds `cms`, sets internal base URL. |
| Base URL | `getCmsBaseUrl()` | Used by `apiRequest` and by `API_BASE_URL` (see below). |
| Default export | `API_BASE_URL` | Object with `toString()` returning `getCmsBaseUrl()` so `${API_BASE_URL}/path` in template literals works. |
| Auth token | `getCmsAuthToken()` | Order: `localStorage.firebase_token` → `VITE_CMS_API_TOKEN`. |
| Auth header | `getCmsAuthHeader()` | `{ Authorization: 'Bearer <token>' }` or `{}` — for raw `fetch` (e.g. file upload, PDF). |
| Request | `apiRequest(endpoint, options, tokenOverride?)` | `fetch(getCmsBaseUrl() + endpoint)` with JSON and Bearer token. Parses JSON; throws on non-OK. |

**Bootstrap:** In `App.jsx`, `useEffect(() => { ensureCmsConfig(); }, []);`.

**Env (`.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_ORIGIN` | Recommended | api-backend origin, e.g. `http://localhost:3000`. |
| `VITE_CMS_API_TOKEN` | Optional | Fallback when no Firebase user is logged in (e.g. health checks). Create in api-backend Admin for system "cms". |

**Backend auth:** CMS backend uses Firebase ID token (project psms-b9ca7) for user identity. Gateway uses `optionalApiTokenForSystem('cms')`: if the request sends a valid CMS API token, the backend treats it as a synthetic Superadmin; otherwise it verifies the Firebase ID token and loads the user from the CMS DB.

**Path convention:** The CMS backend route mount paths use **no hyphens** (e.g. `/merchandiserequests`, `/installmentinvoices`). The frontend must call these exact paths (e.g. `/merchandiserequests`, `/installmentinvoices/invoices`) and not kebab-case (e.g. not `/merchandise-requests` or `/installment-invoices/invoices`), or the backend returns 404.

---

## 5. Environment Variables Summary

| Frontend | Variable | Purpose |
|----------|----------|--------|
| All | `VITE_API_ORIGIN` | api-backend origin (e.g. `http://localhost:3000`). Used to call `/api/external/systems` and to build default base URLs. |
| Funtalk | `VITE_API_BASE_URL` | Optional override for Funtalk base URL. |
| Funtalk | `VITE_FUNTALK_API_TOKEN` | Optional API token for Funtalk. |
| Grading | `VITE_API_URL` | Optional override for Grading base URL. |
| Grading | `VITE_GRADING_API_TOKEN` | **Required** when using api-backend (Grading gateway requires API token). |
| CMS | `VITE_CMS_API_TOKEN` | Optional; fallback when no Firebase token (e.g. before login). |

---

## 6. Bootstrap Checklist

Each external frontend should:

1. **On app init** (e.g. in `App.jsx` or main layout):
   - **Funtalk:** `ensureFuntalkConfig()`
   - **Grading:** `ensureGradingConfig()`
   - **CMS:** `ensureCmsConfig()`
2. Use the **shared API helpers** for all requests (e.g. `fetchFuntalk`, `fetchGrading`, `apiRequest`) so the base URL and auth are consistent.
3. For **raw `fetch`** (e.g. file upload, PDF download), use the same base URL and auth:
   - Funtalk: `getFuntalkBaseUrl()` + `getAuthToken()` (or build headers from it).
   - Grading: `gradingUrl(path)` + `getAuthHeader()`.
   - CMS: `getCmsBaseUrl()` (or `API_BASE_URL`) + `getCmsAuthHeader()` or `getCmsAuthToken()`.

---

## 7. Adding a New External Frontend

To wire a new external frontend to a new backend via the api-backend:

1. **api-backend**
   - Add a mount in `server.js` (e.g. `/api/newsystem`) and use `requireApiTokenForSystem('newsystem')` or `optionalApiTokenForSystem('newsystem')` as appropriate.
   - Add a mount script (e.g. `newsystemMount.js`) that loads the backend router and sets env from `systems_config`.
   - Run migration (or insert into `systems_config`) so the system has `api_path_slug = 'newsystem'` and DB/config as needed.

2. **External frontend**
   - Add a small **API client** module (e.g. `src/lib/api.js`) that:
     - Defines default base URL from `VITE_API_ORIGIN + '/api/newsystem'`.
     - Exposes `ensureNewsystemConfig()` that fetches `GET /api/external/systems`, finds the system by slug, and sets the base URL.
     - Exposes `getNewsystemBaseUrl()`, and either a `fetchNewsystem(path, options)` or equivalent that adds auth (API token and/or app-specific token).
   - In `.env`, add `VITE_API_ORIGIN` and any token env (e.g. `VITE_NEWSYSTEM_API_TOKEN`).
   - In the app root, call `ensureNewsystemConfig()` once on mount.
   - Replace any direct `fetch(API_URL + ...)` with the new helper so all requests go through the same base URL and auth.

3. **Path and auth**
   - Match path conventions to the backend (no extra `/api` prefix unless the backend expects it; match hyphen vs no-hyphen as in the backend routes).
   - If the gateway requires an API token, document that the frontend must set it (env or from login) and send it on every request.

---

## 8. Related Files

| Area | Location |
|------|----------|
| api-backend mount + auth | `api-backend/src/server.js` |
| Systems registry | `api-backend/src/routes/external.js` (GET /api/external/systems) |
| Funtalk mount | `api-backend/src/funtalkMount.js` |
| Grading mount | `api-backend/src/gradingMount.js` |
| CMS mount | `api-backend/src/cmsMount.js` |
| Gateway API token middleware | `api-backend/src/middleware/apiTokenAuth.js` |
| Funtalk frontend API client | `external-frontend/funtalk-frontend/src/lib/api.js` |
| Grading frontend API client | `external-frontend/grading-frontend/src/lib/api.js` |
| CMS frontend API client | `external-frontend/cms-frontend/src/lib/api.js` + `src/config/api.js` |
