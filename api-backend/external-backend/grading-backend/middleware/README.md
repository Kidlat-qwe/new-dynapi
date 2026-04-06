# Grading backend middleware

## setCurrentUser.js

**Purpose:** When the request includes a Bearer token (Firebase ID token or grading JWT from `/auth/login`), resolve the current user from the grading DB and set `req.user = { email }`. This allows the api-backend (when grading is mounted in-process) to log the **actual user** in `system_request_log` (e.g. `paulcamus11@gmail.com`) instead of the API token owner.

- Does not block the request if the token is missing or invalid.
- Skips when Bearer token looks like an API key (`sk_*`).
- Uses `GRADING_JWT_SECRET` env var if set; otherwise falls back to the default JWT secret used by `/auth/login`.
