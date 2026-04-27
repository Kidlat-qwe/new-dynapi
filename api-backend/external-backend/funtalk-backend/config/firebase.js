import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
// IMPORTANT (embedded mode via api-backend):
// api-backend may already initialize a default Firebase Admin app for a different project.
// Funtalk must verify tokens issued by funtalk-77c3d, so we always use a separate NAMED app.
const FUNTALK_APP_NAME = 'funtalk';
let firebaseApp;

try {
  // Reuse existing named app if already initialized
  try {
    firebaseApp = admin.app(FUNTALK_APP_NAME);
  } catch (_) {
    // not initialized
  }
  if (firebaseApp) {
    // Already initialized in this process
    // eslint-disable-next-line no-empty
  } else {
  // Method 1: Try to use service account JSON file (for development)
  // Check for the specific Funtalk service account file first
  const funtalkServiceAccountPath = join(__dirname, 'funtalk-77c3d-firebase-adminsdk-fbsvc-47aa67f9e8.json');
  const genericServiceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
  
  let serviceAccountPath = null;
  if (existsSync(funtalkServiceAccountPath)) {
    serviceAccountPath = funtalkServiceAccountPath;
  } else if (existsSync(genericServiceAccountPath)) {
    serviceAccountPath = genericServiceAccountPath;
  }
  
  if (serviceAccountPath) {
    // Use service account JSON file
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    firebaseApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'funtalk-77c3d',
      },
      FUNTALK_APP_NAME
    );

    console.log('✅ Firebase Admin SDK initialized successfully (using service account file)');
    console.log(`   Using: ${serviceAccountPath.split('/').pop() || serviceAccountPath.split('\\').pop()}`);
  }
  // Method 2: Use environment variables (for production)
  else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    // Parse the private key (it might be stored with escaped newlines)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    firebaseApp = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
      },
      FUNTALK_APP_NAME
    );

    console.log('✅ Firebase Admin SDK initialized successfully (using environment variables)');
  } else {
    console.warn('⚠️  Firebase credentials not found. Firebase features will be disabled.');
    console.warn('   To enable Firebase:');
    console.warn('   1. Place funtalk-77c3d-firebase-adminsdk-fbsvc-47aa67f9e8.json in backend/config/ folder, OR');
    console.warn('   2. Place firebase-service-account.json in backend/ folder, OR');
    console.warn('   3. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env');
  }
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization error:', error.message);
  if (error.code === 'ENOENT') {
    console.error('   Service account file not found. Using environment variables instead.');
  }
}

/**
 * Check if email exists in Firebase
 */
export const checkEmailExists = async (email) => {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  try {
    const user = await firebaseApp.auth().getUserByEmail(email);
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
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  try {
    const userRecord = await firebaseApp.auth().createUser({
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
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK is not initialized');
  }

  try {
    const userRecord = await firebaseApp.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
};

/**
 * Delete user from Firebase
 * @returns {{ deleted: boolean, skipped?: boolean, missing?: boolean }}
 */
export const deleteFirebaseUser = async (uid) => {
  if (!firebaseApp || !uid) {
    return { deleted: false, skipped: true };
  }

  try {
    await firebaseApp.auth().deleteUser(uid);
    return { deleted: true };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { deleted: true, missing: true };
    }
    throw error;
  }
};

/**
 * Update Firebase Auth user (email, password, display name).
 * No-ops when Firebase is not configured.
 */
export const updateFirebaseUser = async (uid, { email, password, displayName } = {}) => {
  if (!uid) return;
  if (!firebaseApp) {
    console.warn('Firebase not initialized; skipping Firebase user update');
    return;
  }

  const updates = {};
  if (email !== undefined && email !== null) {
    updates.email = String(email).trim().toLowerCase();
  }
  if (password) {
    updates.password = password;
  }
  if (displayName !== undefined && displayName !== null) {
    updates.displayName = displayName;
  }
  if (Object.keys(updates).length === 0) {
    return;
  }
  await firebaseApp.auth().updateUser(uid, updates);
};

export default firebaseApp;

