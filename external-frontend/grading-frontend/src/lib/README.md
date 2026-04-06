# Grading frontend – shared lib

## `api.js`

Central API client for the Grading backend (mounted on api-backend at `/api/grading`).

- **Base URL**: Fetched from api-backend on app init via `GET /api/external/systems` (system with `api_path_slug === 'grading'`). Fallback: `VITE_API_URL` or `http://localhost:3000/api/grading`.
- **Auth**: For `Authorization: Bearer`, prefers logged-in user token (`userToken`) so system logs show the actual user; falls back to API token when no user is logged in. `X-API-Key` is always sent with the API token (env or `grading_api_token`) when available so the api-backend can validate and count usage.
- **Paths**: Backend routes are `/users`, `/school-years`, `/classes`, etc. (no `/api` prefix). Use paths like `/api/school-years` in code; they are normalized to `/school-years`.

### Usage

- **fetch**: `fetchGrading('/api/school-years')` or `fetchGrading('/users/byEmail/x')`
- **axios**: `axios.get(gradingUrl('/api/school-years'), { headers: getAuthHeader() })`
- **Bootstrap**: `ensureGradingConfig()` is called in `App.jsx` on mount.

### Env

- `VITE_API_ORIGIN`: API backend origin (e.g. `http://localhost:3000`).
- `VITE_API_URL`: Override Grading base URL if it contains `grading`.
- `VITE_GRADING_API_TOKEN`: API token for `/api/grading` (required when using api-backend).

### Migrating remaining pages

Any page that still uses `const API_URL = import.meta.env.VITE_API_URL` and `${API_URL}/api/...` or `${API_URL}/users/...` should be updated to use `gradingUrl()`, `fetchGrading()`, and `getAuthHeader()` (for axios). See `Login.jsx`, `Manage-class.jsx`, `View-grade.jsx`, `Manage-user.jsx`, `My-class.jsx`, `School-year.jsx`, `Manage-subject.jsx`, `Manage-teacher.jsx`, `Grading-criteria.jsx` for examples.
