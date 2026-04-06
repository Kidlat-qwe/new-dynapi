# API Frontend

React frontend for the multi-system/database management API. Uses Vite, Tailwind CSS, Shadcn-style components (Radix UI), and React Router.

## Structure

- `src/components/` — Reusable UI
  - `ui/` — Shadcn-style primitives (Button, Input, Card, Label)
  - `Sidebar.jsx` — Dashboard navigation
  - `Header.jsx` — Top bar with user info
- `src/contexts/` — AuthContext (Firebase Auth, role-based)
- `src/config/` — firebase.js (see [config/README.md](src/config/README.md))
- `src/layouts/` — DashboardLayout (Sidebar + Header + outlet)
- `src/pages/` — Route pages
  - `Login.jsx`, `Signup.jsx` — Auth (public)
  - `admin/adminDashboard.jsx`, `admin/adminSystems.jsx` — Admin area
  - `user/userDashboard.jsx`, `user/userSystems.jsx` — User area
- `src/lib/utils.js` — `cn()` for class merging

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Sign in with Firebase (email/password); select role (admin/user) to enter the corresponding dashboard.

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/login` | Public | Sign in |
| `/signup` | Public | Create account |
| `/admin` | Admin | Admin dashboard |
| `/admin/systems` | Admin | Systems config (fetches from API) |
| `/user` | User | User dashboard |
| `/user/systems` | User | Assigned systems |

## Stack

- React 19, Vite 7
- Tailwind CSS, Shadcn-style (Radix UI, CVA, clsx, tailwind-merge)
- React Router v7

## Database alignment

UI aligns with `docs/database.md`:

- **users** — email, fname, lname, role
- **systems_config** — Admin Systems page
- **user_permission** — User Systems page (placeholder)

Auth is **Firebase** (email/password). Role is stored locally per UID; backend can verify tokens with Firebase Admin.
