/**
 * Firebase Admin SDK.
 * Used to verify ID tokens from the frontend (Firebase Auth).
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, 'new-api-a316d-firebase-adminsdk-fbsvc-ee382245b2.json');

let initialized = false;

function loadServiceAccount() {
  if (!existsSync(serviceAccountPath)) return null;
  try {
    const raw = readFileSync(serviceAccountPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (process.env.QUIET_STARTUP !== '1') {
      console.warn('Firebase Admin: could not load service account file', err.message);
    }
    return null;
  }
}

/**
 * Initialize Firebase Admin (idempotent).
 */
function initializeFirebaseAdmin() {
  if (initialized) return;
  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      if (process.env.QUIET_STARTUP !== '1') {
        console.warn('Firebase Admin init skipped: no service account');
      }
      return;
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('Firebase Admin: initialized (ID token verification enabled)');
    }
  } catch (err) {
    if (process.env.QUIET_STARTUP !== '1') {
      console.warn('Firebase Admin init skipped:', err.message);
      console.warn('  → 401 on /api/users/me and /api/admin/* until service account is added. See api-backend/src/config/');
    }
  }
}

/**
 * Verify a Firebase ID token (Bearer token).
 * @param {string} idToken - Token from frontend (auth.currentUser.getIdToken()).
 * @returns {Promise<{ decoded: admin.auth.DecodedIdToken }|{ notConfigured: true }|{ invalid: true, message?: string }>}
 */
export async function verifyIdToken(idToken) {
  initializeFirebaseAdmin();
  if (!admin.apps.length) return { notConfigured: true };
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { decoded };
  } catch (err) {
    return { invalid: true, message: err?.message || 'Token verification failed' };
  }
}

export { admin, initializeFirebaseAdmin };
