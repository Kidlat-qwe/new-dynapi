# Admin pages

- **adminDashboard.jsx** — Overview: links to Systems, Manage users, and API tokens; system count.
- **adminSystems.jsx** — Full CRUD for system/database config: list, Add system modal, Edit/Delete per row. Uses `/api/systems`. Responsive table; modal form for create/edit.
- **adminUsers.jsx** — List users from DB; edit role and is_active via modal. Uses `GET /api/admin/users`, `PATCH /api/admin/users/:id` (requires admin Bearer token).
- **adminApiTokens.jsx** — List API tokens; create token (user, name, optional system); show plain token once; revoke. Uses `GET /api/admin/api-tokens`, `POST /api/admin/api-tokens`, `PATCH /api/admin/api-tokens/:id` (requires admin Bearer token).
- **adminHealthMonitoring.jsx** — Health checks for external system DBs; summary cards (healthy/degraded/down/alerts); config modal (webhook, primary emails); auto-refresh every 10s. Uses `GET /api/systems/health`, monitoring-config, test-webhook.
- **adminSystemLogs.jsx** — System logs: table of API requests to external systems (user email, system, route, method, status, timestamp, execution time). Filter by system and user email; pagination; View details modal. Uses `GET /api/admin/system-logs`. Logs are written when requests use an API token (see apiTokenAuth).
