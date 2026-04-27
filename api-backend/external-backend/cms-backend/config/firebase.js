import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Env is loaded by loadEnv.js ( .env then .env.${NODE_ENV} ) before this module runs
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * IMPORTANT (embedded mode via api-backend):
 * The api-backend initializes its own Firebase Admin app (new-api-a316d) at process startup.
 * CMS must verify tokens issued by psms-b9ca7, so we always initialize/use a separate NAMED app ("cms").
 * Otherwise verifyIdToken fails with an "audience" mismatch.
 */
const CMS_APP_NAME = 'cms';

function resolveAdminSdkPath(adminSdkPath) {
  if (!adminSdkPath) return null;
  const pathsToTry = [
    // 1. Relative to current working directory
    resolve(process.cwd(), adminSdkPath),
    // 2. Relative to backend directory (if running from root)
    resolve(process.cwd(), 'backend', adminSdkPath),
    // 3. Relative to this file's directory
    resolve(__dirname, adminSdkPath.replace(/^\.\//, '')),
    // 4. Absolute path (if provided)
    adminSdkPath.startsWith('/') || (process.platform === 'win32' && /^[A-Za-z]:/.test(adminSdkPath))
      ? adminSdkPath
      : null,
  ].filter(Boolean);

  for (const pathToTry of pathsToTry) {
    if (existsSync(pathToTry)) return pathToTry;
  }
  return null;
}

function buildCredential() {
  // Option 1: Use JSON file if path is provided via environment variable
  const adminSdkPath = process.env.FIREBASE_ADMIN_SDK_PATH;
  const resolvedPath = resolveAdminSdkPath(adminSdkPath);
  if (resolvedPath) {
    console.log('✅ CMS Firebase Admin using JSON file:', resolvedPath);
    return admin.credential.cert(resolvedPath);
  }
  if (adminSdkPath) {
    console.warn('⚠️  FIREBASE_ADMIN_SDK_PATH is set but file not found:', adminSdkPath);
  }

  // Option 2: Use environment variables (fallback method)
  const projectId = process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error(
      'Missing required Firebase Admin credentials for CMS. ' +
      'Set FIREBASE_ADMIN_SDK_PATH to a valid JSON file path, ' +
      'or provide FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.'
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
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  console.log('✅ CMS Firebase Admin using environment variables');
  return admin.credential.cert(serviceAccount);
}

let cmsApp;
try {
  cmsApp = admin.app(CMS_APP_NAME);
} catch (_) {
  // not initialized
}

if (!cmsApp) {
  try {
    const credential = buildCredential();
    cmsApp = admin.initializeApp(
      {
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7',
      },
      CMS_APP_NAME
    );
    console.log('✅ CMS Firebase Admin initialized successfully (named app)');
  } catch (error) {
    console.error('❌ Error initializing CMS Firebase Admin:', error);
    throw error;
  }
}

export default cmsApp;

