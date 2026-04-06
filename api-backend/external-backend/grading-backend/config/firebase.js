/**
 * Grading backend Firebase Admin (project: rhet-grading).
 * Uses a named app 'grading' so it doesn't conflict with the api-backend's default Firebase app.
 * Use getGradingAdmin() in middleware when verifying Firebase ID tokens from the grading frontend.
 */

import admin from 'firebase-admin';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GRADING_APP_NAME = 'grading';
const DEFAULT_PROJECT_ID = 'rhet-grading';

function getGradingApp() {
  const existing = admin.apps.find((a) => a && a.name === GRADING_APP_NAME);
  if (existing) return existing;

  try {
    let credential = null;

    const sdkPath = process.env.FIREBASE_ADMIN_SDK_PATH;
    if (sdkPath) {
      const candidates = [
        sdkPath,
        resolve(process.cwd(), sdkPath),
        resolve(__dirname, sdkPath.replace(/^\.\//, '')),
      ].filter(Boolean);
      for (const p of candidates) {
        if (existsSync(p)) {
          credential = admin.credential.cert(p);
          if (process.env.QUIET_STARTUP !== '1') {
            console.log('✅ Grading Firebase Admin (grading) initialized from JSON file:', p);
          }
          break;
        }
      }
    }

    if (!credential) {
      try {
        const files = readdirSync(__dirname).filter(
          (f) => f.startsWith('rhet-grading') && f.endsWith('.json')
        );
        if (files.length > 0) {
          const p = resolve(__dirname, files[0]);
          credential = admin.credential.cert(p);
          if (process.env.QUIET_STARTUP !== '1') {
            console.log('✅ Grading Firebase Admin (grading) initialized from bundled JSON:', p);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!credential) {
      const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      if (projectId && privateKey && clientEmail) {
        credential = admin.credential.cert({ projectId, privateKey, clientEmail });
        if (process.env.QUIET_STARTUP !== '1') {
          console.log('✅ Grading Firebase Admin (grading) initialized from environment variables');
        }
      }
    }

    if (!credential) {
      if (process.env.QUIET_STARTUP !== '1') {
        console.warn(
          '⚠️  Grading Firebase Admin credentials not found. Firebase token verification will fail.\n' +
            '   Set FIREBASE_ADMIN_SDK_PATH to the rhet-grading Admin SDK JSON file, or\n' +
            '   place rhet-grading-firebase-adminsdk-*.json in grading-backend/config/.'
        );
      }
      return null;
    }

    return admin.initializeApp(
      { credential, projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID },
      GRADING_APP_NAME
    );
  } catch (error) {
    console.error('❌ Grading Firebase Admin init error:', error.message || error);
    return null;
  }
}

getGradingApp();

/** Returns the named 'grading' Firebase Admin app instance, or null if not initialized. */
export function getGradingAdmin() {
  const app = admin.apps.find((a) => a && a.name === GRADING_APP_NAME);
  return app || null;
}

export default admin;
