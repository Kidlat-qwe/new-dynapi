# API Backend

Node.js API backend for **managing multiple systems/databases**. Built with Express; PostgreSQL and Firebase Admin for token verification.

## Structure

- `src/` — Application source
  - `app.js` — Express app (middleware, route mounting)
  - `server.js` — HTTP server entry (loads `.env` via dotenv)
  - `config/` — DB and Firebase (see [config/README.md](src/config/README.md))
    - `db.js` — PostgreSQL pool (main API DB: new_api_db)
    - `systemPools.js` — Pools for external system databases (e.g. Funtalk’s funtalk_db); uses credentials from `systems_config`
    - `firebaseAdmin.js` — Firebase Admin (verify ID tokens); uses service account JSON
  - `routes/` — Endpoints by purpose
    - `index.js` — Route aggregator
    - `health.js` — Health/liveness/readiness (ready checks DB)
    - `systems.js` — Systems config CRUD (PostgreSQL), `GET :id/routes`, `GET :id/connection-test`
    - `external.js` — Managed external systems (list systems with `external_base_url`)
- `external-backend/` — External backends (e.g. Funtalk); migrate into API via `scripts/migrate-funtalk-to-api.js` (see [external-backend/README.md](external-backend/README.md))

## Database config (PostgreSQL)

Matches your pgAdmin connection. Copy `.env.example` to `.env` and set:

- `DB_HOST` — default `localhost`
- `DB_PORT` — default `5432`
- `DB_NAME` — default `new_api_db`
- `DB_USER` — default `postgres`
- `DB_PASSWORD` — set to your DB password (e.g. `2025`)

Do not commit `.env`; it is in `.gitignore`. Ensure the `users` table exists (run the schema in `docs/database.md` in pgAdmin on `new_api_db`).

## Run

```bash
cd api-backend
npm install
cp .env.example .env
# Edit .env and set DB_PASSWORD
npm start
```

Server runs at `http://localhost:3000` (or `PORT` env). Use `GET /api/health/ready` to verify DB connection.

## API Endpoints

| Purpose   | Base path        | Description |
|----------|------------------|-------------|
| Root     | `GET /`          | Service info and list of endpoints |
| Health   | `GET /api/health` | Status and timestamp |
| Health   | `GET /api/health/live` | Liveness (plain `ok`) |
| Health   | `GET /api/health/ready` | Readiness (tests PostgreSQL connection) |
| Systems  | `GET /api/systems` | List systems (from PostgreSQL) |
| Systems  | `GET /api/systems/:id` | Get one system |
| Systems  | `GET /api/systems/:id/routes` | List routes for this system |
| Systems  | `GET /api/systems/:id/connection-test` | Test DB connection to this system’s database |
| Systems  | `POST /api/systems` | Create system |
| Systems  | `PUT /api/systems/:id` | Update system |
| Systems  | `DELETE /api/systems/:id` | Delete system |
| External | `GET /api/external` | Info and link to managed systems |
| External | `GET /api/external/systems` | List managed external systems (with external_base_url) |
| Users     | `POST /api/users/sync` | Sync Firebase user to PostgreSQL (Bearer token + body: fname?, lname?, role?) |
| Users     | `GET /api/users/me` | Current user from PG (Bearer token) |

Systems payload shape follows `docs/database.md` (`systems_config`: system_name, system_description, database_type, database_host, database_port, database_name, database_user, database_password, database_ssl, is_active, external_base_url). Passwords are redacted in responses. The API system can open a direct PostgreSQL connection to each system’s database (see `config/systemPools.js`); use the connection-test endpoint or Admin UI “Test DB” to verify (e.g. Funtalk’s funtalk_db).

## Firebase

Auth is handled by Firebase. The backend can verify frontend ID tokens via `verifyIdToken()` in `src/config/firebaseAdmin.js`. Place the Firebase Admin service account JSON in `src/config/` (or set `GOOGLE_APPLICATION_CREDENTIALS`). The file is in `.gitignore`; do not commit it.

## Later

- Protect API routes using `verifyIdToken()` middleware where needed
- Proxy requests to external backends using `external_base_url` and `system_routes`
