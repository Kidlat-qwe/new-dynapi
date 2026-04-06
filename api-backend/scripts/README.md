# API Backend Scripts

## migrate-funtalk-to-api.js

Migrates the **Funtalk** external backend into the API system:

1. **Database connection** – Reads `external-backend/funtalk-backend/.env` and inserts one row into `systems_config` (system name "Funtalk", PostgreSQL connection from that .env, and `external_base_url` from Funtalk’s `PORT`).
2. **Proxy config** – Sets `external_base_url` to `http://localhost:<PORT>/api` and `api_path_slug` to `funtalk` so the main server proxies at `/api/funtalk/*`.
3. **Routes** – Inserts or replaces all Funtalk API endpoints in `system_routes` (from `funtalk-routes-manifest.js`).

### Prerequisites

- API backend PostgreSQL is running and `api-backend/.env` is set (DB_* for `new_api_db`).
- Funtalk `.env` exists at `external-backend/funtalk-backend/.env` (or pass a path).

### Usage

From **api-backend** root:

```bash
node scripts/migrate-funtalk-to-api.js
```

Optional: custom path to Funtalk `.env`:

```bash
node scripts/migrate-funtalk-to-api.js path/to/funtalk/.env
```

### Output

- One new row in `systems_config` (Funtalk).
- Many rows in `system_routes` linked to that system.
- Logs: system_id, external_base_url, and hint to view routes via `GET /api/systems/:id/routes`.

### After migration

- **Admin UI** – Systems list shows "Funtalk"; you can view/edit the system, **Test DB** to verify the API system can connect to Funtalk’s database, and see routes via `GET /api/systems/:id/routes`.
- **Database connection** – The API system uses the migrated config to open a direct PostgreSQL connection to the Funtalk database (funtalk_db). Use `GET /api/systems/:id/connection-test` or the "Test DB" button in Admin → Systems to verify.
- **Single port** – Funtalk runs in the same process as the API backend. Use `http://localhost:3000/api/funtalk/users` (and other paths). No separate Funtalk server or port.

### Files

- `migrate-funtalk-to-api.js` – Entry script; parses Funtalk .env, ensures tables, inserts system + routes.
- `funtalk-routes-manifest.js` – List of `{ method, path_pattern, description }` for all Funtalk API routes. Update this if Funtalk adds or changes endpoints.

---

## migrate-grading-to-api.js

Migrates the **Grading** (LCA Portal) external backend into the API system, following the same pattern as Funtalk:

1. **Database connection** – Reads `external-backend/grading-backend/.env` and inserts or updates one row in `systems_config` (system name "Grading", PostgreSQL from that .env).
2. **Single port** – Sets `api_path_slug` to `grading` and `external_base_url` to `null`; Grading runs in-process at `/api/grading/*` on the API backend server.
3. **Routes** – Inserts or replaces all Grading API endpoints in `system_routes` (from `grading-routes-manifest.js`).

### Prerequisites

- API backend PostgreSQL is running and `api-backend/.env` is set (DB_* for `new_api_db`).
- Grading `.env` exists at `external-backend/grading-backend/.env` (or pass a path).
- Run `npm install` in `external-backend/grading-backend` so its dependencies (e.g. bcrypt, jsonwebtoken, pg) are available when the grading router is loaded in-process.

### Usage

From **api-backend** root:

```bash
node scripts/migrate-grading-to-api.js
```

Optional: custom path to Grading `.env`:

```bash
node scripts/migrate-grading-to-api.js path/to/grading/.env
```

### After migration

- **Admin UI** – Systems list shows "Grading"; you can view DB config, **Test DB**, and **View** routes.
- **Single port** – Grading runs in the same process. Use `http://localhost:3000/api/grading/classes`, `/api/grading/grades`, etc. API tokens for the Grading system are required (Bearer `sk_xxx` or `X-API-Key`).

### Files

- `migrate-grading-to-api.js` – Entry script; parses Grading .env, ensures tables, inserts/updates system + routes.
- `grading-routes-manifest.js` – List of `{ method, path_pattern, description }` for all Grading API routes.

---

## migrate-cms-to-api.js

Migrates the **CMS** (Physical School Management System) external backend into the API system:

1. **Database connection** – Reads `external-backend/cms_backend/.env` and uses `DB_*_DEVELOPMENT` or `DB_*_PRODUCTION` based on `NODE_ENV` in that file. Inserts or updates one row in `systems_config` (system name "CMS").
2. **Single port** – Sets `api_path_slug` to `cms`; CMS runs in-process at `/api/cms/*` on the API backend server.
3. **Routes** – Inserts or replaces all CMS API endpoints in `system_routes` (from `cms-routes-manifest.js`).

### Prerequisites

- API backend PostgreSQL is running and `api-backend/.env` is set.
- CMS `.env` exists at `external-backend/cms_backend/.env` (or pass a path).
- Run `npm install` in `external-backend/cms_backend` if you run the CMS standalone; when mounted in-process, api-backend resolves CMS deps from its own `node_modules` or cms_backend’s.

### Usage

From **api-backend** root:

```bash
node scripts/migrate-cms-to-api.js
```

Optional: custom path to CMS `.env`:

```bash
node scripts/migrate-cms-to-api.js path/to/cms_backend/.env
```

### After migration

- **Admin UI** – Systems list shows "CMS"; view DB config, **Test DB**, and **View** routes.
- **Single port** – CMS at `http://localhost:3000/api/cms/branches`, `/api/cms/classes`, etc. API tokens for the CMS system are required (Bearer `sk_xxx` or `X-API-Key`).

### Files

- `migrate-cms-to-api.js` – Entry script; parses CMS .env (NODE_ENV + DB_*_DEVELOPMENT/_PRODUCTION), ensures tables, inserts/updates system + routes.
- `cms-routes-manifest.js` – List of `{ method, path_pattern, description }` for CMS API routes.
