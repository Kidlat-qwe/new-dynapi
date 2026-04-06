# Config

- **db.js** — PostgreSQL connection pool. Reads from env: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Set `DB_PASSWORD` in `.env` (never commit `.env`).
- **firebaseAdmin.js** — Firebase Admin SDK. Verifies frontend Firebase ID tokens. Uses `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON) or defaults to `new-api-a316d-firebase-adminsdk-fbsvc-ee382245b2.json` in this folder. Do not commit the service account file; it is in `.gitignore`.
