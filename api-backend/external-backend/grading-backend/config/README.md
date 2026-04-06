# Grading backend config

## Firebase Admin (rhet-grading)

The Grading backend uses a **named** Firebase Admin app (`grading`) for project **rhet-grading**, so it does not conflict with the api-backend’s default Firebase app.

To enable Firebase ID token verification (e.g. when the grading frontend logs in with Firebase):

1. In [Firebase Console](https://console.firebase.google.com/) → project **rhet-grading** → Project settings → Service accounts, generate a new private key and download the JSON file.
2. Rename or copy the file so it matches `rhet-grading-*.json` (e.g. `rhet-grading-firebase-adminsdk-xxxxx.json`) and place it in this directory (`grading-backend/config/`).
3. The backend will auto-discover it on load. No env vars are required for file-based credentials.

Alternatively, set environment variables:

- `FIREBASE_PROJECT_ID=rhet-grading`
- `FIREBASE_ADMIN_SDK_PATH` = path to the JSON file, or
- `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` (and optionally `FIREBASE_PROJECT_ID`)

When the Grading backend is mounted in the api-backend, `FIREBASE_PROJECT_ID` is set to `rhet-grading` automatically.
