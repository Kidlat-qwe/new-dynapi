import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Named Firebase Admin app for CMS (psms-b9ca7).
 * When embedded in api-backend, the default app is already the API gateway project (new-api);
 * we must not reuse it — verifyIdToken would reject CMS users' ID tokens.
 */
export const CMS_FIREBASE_APP_NAME = 'cms';

function initCmsFirebaseApp() {
  try {
    admin.app(CMS_FIREBASE_APP_NAME);
    return;
  } catch {
    /* not initialized yet */
  }

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
        console.log('✅ CMS Firebase Admin: credential from JSON', resolvedPath);
      }
    } else if (process.env.QUIET_STARTUP !== '1') {
      console.warn('⚠️  FIREBASE_ADMIN_SDK_PATH set but file not found:', adminSdkPath);
    }
  }

  if (!credential) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error(
        'CMS Firebase Admin: set FIREBASE_ADMIN_SDK_PATH to the psms-b9ca7 service account JSON, ' +
          'or set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL.'
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

  admin.initializeApp(
    {
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7',
    },
    CMS_FIREBASE_APP_NAME
  );
  if (process.env.QUIET_STARTUP !== '1') {
    console.log('✅ CMS Firebase Admin app [%s] ready (project %s)', CMS_FIREBASE_APP_NAME, process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7');
  }
}

initCmsFirebaseApp();

/** Use this for all CMS Auth operations (verifyIdToken, deleteUser, …). */
export function getCmsAuth() {
  return admin.app(CMS_FIREBASE_APP_NAME).auth();
}

export default admin;
