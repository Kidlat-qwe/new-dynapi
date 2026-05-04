import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * CMS must use its own Firebase Admin app name. The parent api-backend already initializes
 * the default app for the gateway (new-api); verifying psms-b9ca7 ID tokens with that app fails.
 */
export const CMS_FIREBASE_APP_NAME = 'cms-psms-embedded';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Same filename as api-backend/src/cmsMount.js (embedded CMS); works after mount restores env. */
const BUNDLED_SERVICE_ACCOUNT_JSON = resolve(
  __dirname,
  'psms-b9ca7-firebase-adminsdk-fbsvc-0923308123.json'
);

function resolveCredential() {
  let credential;

  const adminSdkPath = process.env.FIREBASE_ADMIN_SDK_PATH;

  if (adminSdkPath) {
    const pathsToTry = [
      resolve(process.cwd(), adminSdkPath),
      resolve(process.cwd(), 'backend', adminSdkPath),
      resolve(__dirname, adminSdkPath.replace(/^\.\//, '')),
      adminSdkPath.startsWith('/') || (process.platform === 'win32' && /^[A-Za-z]:/.test(adminSdkPath))
        ? adminSdkPath
        : null,
    ].filter(Boolean);

    let resolvedPath = null;
    for (const pathToTry of pathsToTry) {
      if (existsSync(pathToTry)) {
        resolvedPath = pathToTry;
        break;
      }
    }

    if (resolvedPath) {
      credential = admin.credential.cert(resolvedPath);
      if (process.env.QUIET_STARTUP !== '1') {
        console.log('✅ CMS Firebase Admin: credential from JSON:', resolvedPath);
      }
    } else {
      console.warn('⚠️  FIREBASE_ADMIN_SDK_PATH set but file not found:', adminSdkPath);
    }
  }

  if (!credential && existsSync(BUNDLED_SERVICE_ACCOUNT_JSON)) {
    credential = admin.credential.cert(BUNDLED_SERVICE_ACCOUNT_JSON);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('✅ CMS Firebase Admin: credential from bundled JSON:', BUNDLED_SERVICE_ACCOUNT_JSON);
    }
  }

  if (!credential) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error(
        'CMS Firebase Admin: set FIREBASE_ADMIN_SDK_PATH to the psms-b9ca7 service account JSON, ' +
          'or set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL for psms-b9ca7.'
      );
    }

    const serviceAccount = {
      projectId,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey,
      clientEmail,
      clientId: process.env.FIREBASE_CLIENT_ID,
      authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      authProviderX509CertUrl:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    credential = admin.credential.cert(serviceAccount);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('✅ CMS Firebase Admin: credential from environment variables');
    }
  }

  return credential;
}

/**
 * Lazy singleton: named app so it never clashes with api-backend's default Firebase app.
 */
export function ensureCmsFirebaseApp() {
  try {
    return admin.app(CMS_FIREBASE_APP_NAME);
  } catch {
    const credential = resolveCredential();
    const projectId = process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7';
    admin.initializeApp({ credential, projectId }, CMS_FIREBASE_APP_NAME);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('✅ CMS Firebase Admin initialized (named app:', CMS_FIREBASE_APP_NAME + ', project:', projectId + ')');
    }
    return admin.app(CMS_FIREBASE_APP_NAME);
  }
}

/** Auth service for psms-b9ca7 — use this for verifyIdToken / deleteUser in CMS code. */
export function getCmsAuth() {
  return ensureCmsFirebaseApp().auth();
}

export default admin;
