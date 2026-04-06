# Funtalk frontend – shared lib

## `api.js`

Central API client for talking to the Funtalk backend (via the api-backend at `/api/funtalk`).

- **Base URL**: Fetched from the api-backend on app init via `GET /api/external/systems` (system with `api_path_slug === 'funtalk'`). Fallback: `VITE_API_BASE_URL` or `http://localhost:3000/api/funtalk`.
- **Auth**: Uses (in order) env `VITE_FUNTALK_API_TOKEN`, then localStorage `funtalk_api_token`, then JWT from login (`token`). All requests send `Authorization: Bearer <token>` when a token is present.
- **Usage**: Call `ensureFuntalkConfig()` once on app load (done in `App.jsx`). Then use `fetchFuntalk(path, options)` for all Funtalk API calls (path must start with `/`). Use `getFuntalkServerOrigin()` for static/file URLs (e.g. material download links).

### Env (optional)

- `VITE_API_ORIGIN`: API backend origin (e.g. `http://localhost:3000`) for fetching systems.
- `VITE_API_BASE_URL`: Override Funtalk base URL if it includes `funtalk` (e.g. `http://localhost:3000/api/funtalk`).
- `VITE_FUNTALK_API_TOKEN`: API token for Funtalk (e.g. `sk_xxx`). When set in `.env`, all Funtalk API calls use this token. Create the token in api-backend Admin > API tokens for the Funtalk system. Optional; if unset, the app uses Firebase login JWT or runtime `setApiToken()` (localStorage).
