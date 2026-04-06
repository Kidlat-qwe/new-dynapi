# External Backend Integration

This folder hosts **external backends** that are managed by the API system. The central API stores their database config and route definitions so it can manage and (optionally) proxy to them.

## Funtalk Backend

- **Path:** `funtalk-backend/`
- **Description:** Funtalk Platform Backend API (B2B English Learning).

### Migrating Funtalk into the API system

From **api-backend** root, run:

```bash
node scripts/migrate-funtalk-to-api.js
```

This script:

1. Reads database config from `external-backend/funtalk-backend/.env` (DB_*, PORT).
2. Inserts or updates one row in `systems_config` (Funtalk, DB connection, `external_base_url` = `http://localhost:<PORT>/api`, `api_path_slug` = `funtalk`).
3. Inserts or replaces all Funtalk API endpoints in `system_routes` (from `scripts/funtalk-routes-manifest.js`).

After migration:

- **Admin UI** → Systems: "Funtalk" appears; you can view/edit the system, its **External base URL**, and use **Test DB** to verify the API system is connected to Funtalk’s database (funtalk_db).
- **Database connection:** The API system connects to the Funtalk database using the migrated config (host, port, database_name, user, password). Use `GET /api/systems/:id/connection-test` or the "Test DB" button to verify.
- **Single port:** Funtalk is mounted in-process at `/api/funtalk`. Use `http://localhost:3000/api/funtalk/users`. No separate Funtalk server or port.
- **API:** `GET /api/systems`, `GET /api/systems/:id/routes`, `GET /api/systems/:id/connection-test`, `GET /api/external/systems`.

See **api-backend/scripts/README.md** for more details and optional custom .env path.

## Purpose

- Keep external backend code (e.g. Funtalk) in one place.
- Central API stores database config and routes for each external system.
- Enables future proxying or unified management from the API system.

## Adding another external backend

1. Add a subfolder (e.g. `external-backend/other-backend/`).
2. Add a route manifest and a migration script (or extend the existing script) to insert into `systems_config` and `system_routes`.
3. Ensure the system row has `external_base_url` set if it should appear under `GET /api/external/systems`.
