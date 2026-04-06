# New API

Multi-system/database management API and frontend. Backend is Node.js (Express); frontend is React (Vite, Tailwind, Shadcn-style).

## Repository layout

- **api-backend/** — Node.js API server (see [api-backend/README.md](api-backend/README.md))
  - Routes: health, systems, external (placeholder)
- **api-frontend/** — React frontend (see [api-frontend/README.md](api-frontend/README.md))
  - Login, Signup, Admin/User dashboards, Sidebar, Header
- **docs/** — Documentation (e.g. [docs/database.md](docs/database.md), [docs/EXTERNAL_FRONTEND_API_SETUP.md](docs/EXTERNAL_FRONTEND_API_SETUP.md) for external frontend → backend setup)
- **api-backend/external-backend/** — Reserved for future external backend integrations

## Quick start

**Backend:**
```bash
cd api-backend
npm install
npm start
```
Then open `http://localhost:3000/api/health`.

**Frontend:**
```bash
cd api-frontend
npm install
npm run dev
```
Then open `http://localhost:5173`. Use any email/password; select role (admin/user) to enter the dashboard.

## Version

Follows [Semantic Versioning](https://semver.org/) (e.g. `1.0.0`).
