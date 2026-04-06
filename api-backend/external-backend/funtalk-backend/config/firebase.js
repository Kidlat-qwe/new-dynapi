import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FUNTALK_APP_NAME = 'funtalk';

/**
 * Get Firebase Admin app for Funtalk (project funtalk-77c3d).
 * Uses a named app so we do not reuse the api-backend's default app (different project).
 * Frontend and backend must use the same Firebase project for ID token verification.
 */
function getFuntalkFirebaseApp() {
  try {
    return admin.app(FUNTALK_APP_NAME);
  } catch {
    return null;
  }
}

function initializeFuntalkFirebase() {
  if (getFuntalkFirebaseApp()) return getFuntalkFirebaseApp();
  try {
    // Method 1: Service account JSON (must match frontend VITE_FIREBASE_PROJECT_ID)
    const funtalkServiceAccountPath = join(__dirname, 'funtalk-77c3d-firebase-adminsdk-fbsvc-47aa67f9e8.json');
    const genericServiceAccountPath = join(__dirname, '..', 'firebase-service-account.json');

    let serviceAccountPath = null;
    if (existsSync(funtalkServiceAccountPath)) {
      serviceAccountPath = funtalkServiceAccountPath;
    } else if (existsSync(genericServiceAccountPath)) {
      serviceAccountPath = genericServiceAccountPath;
    }

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      const app = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        FUNTALK_APP_NAME
      );
      if (process.env.QUIET_STARTUP !== '1') {
        console.log('✅ Funtalk Firebase Admin initialized (project:', serviceAccount.project_id + ')');
      }
      return app;
    }
    // Method 2: Environment variables (project must match frontend)
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const app = admin.initializeApp(
        {
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        },
        FUNTALK_APP_NAME
      );
      console.log('✅ Funtalk Firebase Admin initialized (env, project:', process.env.FIREBASE_PROJECT_ID + ')');
      return app;
    }
  } catch (error) {
    console.error('❌ Funtalk Firebase Admin init error:', error.message);
  }
  return null;
}

let firebaseApp = initializeFuntalkFirebase();

if (!firebaseApp && process.env.QUIET_STARTUP !== '1') {
  console.warn('⚠️  Funtalk Firebase credentials not found. Login/signup will fail until backend uses same project as frontend.');
}

/** Auth instance for Funtalk project (use this for verifyIdToken, getUserByEmail, etc.) */
export function getFuntalkAuth() {
  if (!firebaseApp) return null;
  return firebaseApp.auth();
}

/**
 * Check if email exists in Firebase
 */
export const checkEmailExists = async (email) => {
  const auth = getFuntalkAuth();
  if (!auth) throw new Error('Firebase Admin SDK is not initialized');

  try {
    const user = await auth.getUserByEmail(email);
    return { exists: true, uid: user.uid };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { exists: false, uid: null };
    }
    throw error;
  }
};

/**
 * Create user in Firebase
 */
export const createFirebaseUser = async (email, password, displayName) => {
  const auth = getFuntalkAuth();
  if (!auth) throw new Error('Firebase Admin SDK is not initialized');

  try {
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false,
    });

    return {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
    };
  } catch (error) {
    // Handle Firebase errors
    if (error.code === 'auth/email-already-exists') {
      throw new Error('Email already exists in Firebase');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak');
    }
    throw error;
  }
};

/**
 * Get user by Firebase UID
 */
export const getFirebaseUser = async (uid) => {
  const auth = getFuntalkAuth();
  if (!auth) throw new Error('Firebase Admin SDK is not initialized');

  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  }
};

/**
 * Delete user from Firebase
 */
export const deleteFirebaseUser = async (uid) => {
  const auth = getFuntalkAuth();
  if (!auth) throw new Error('Firebase Admin SDK is not initialized');
  await auth.deleteUser(uid);
  return true;
};

export default firebaseApp;

