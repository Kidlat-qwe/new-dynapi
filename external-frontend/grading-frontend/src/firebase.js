/**
 * Grading frontend Firebase (project: rhet-grading).
 * Config from env (VITE_FIREBASE_*). When VITE_FIREBASE_API_KEY is not set,
 * Firebase is not initialized and login uses the Grading backend (username/password → JWT).
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUser,
  signOut,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
export const isFirebaseConfigured =
  typeof apiKey === "string" && apiKey.trim().length > 0;

let app = null;
let auth = null;

const notConfiguredResult = () => ({
  success: false,
  error: "Firebase is not configured.",
  code: "auth/not-configured",
});

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: apiKey.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rhet-grading.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rhet-grading",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rhet-grading.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { auth };

export const loginWithEmailAndPassword = async (email, password) => {
  if (!auth) return notConfiguredResult();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const createUserWithEmailVerification = async (email, password) => {
  if (!auth) return notConfiguredResult();
  try {
    const userCredential = await firebaseCreateUser(auth, email, password);
    await sendEmailVerification(userCredential.user);
    return {
      success: true,
      user: userCredential.user,
      message: "Verification email sent. Please check your inbox and verify your email before logging in.",
    };
  } catch (error) {
    console.error("User creation error:", error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const createUserWithEmail = async (email, password) => {
  if (!auth) return notConfiguredResult();
  try {
    const userCredential = await firebaseCreateUser(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("User creation error:", error);
    return { success: false, error: error.message, code: error.code };
  }
};

export const createUserWithEmailAndPassword = createUserWithEmailVerification;

export const logoutUser = async () => {
  if (!auth) return notConfiguredResult();
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
};

export const deleteFirebaseUser = async (uid) => {
  if (!auth) return notConfiguredResult();
  try {
    const user = auth.currentUser;
    if (user && user.uid === uid) {
      await deleteUser(user);
      return { success: true };
    }
    console.error("Cannot delete user: No matching user found");
    return { success: false, error: "User not found" };
  } catch (error) {
    console.error("Error deleting Firebase user:", error);
    return { success: false, error: error.message };
  }
};

export const resendVerificationEmail = async (user) => {
  if (!auth) return notConfiguredResult();
  try {
    await sendEmailVerification(user);
    return { success: true, message: "Verification email sent. Please check your inbox." };
  } catch (error) {
    console.error("Error sending verification email:", error);
    return { success: false, error: error.message };
  }
};

export const sendPasswordResetEmail = async (email) => {
  if (!auth) return notConfiguredResult();
  try {
    await firebaseSendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent. Please check your inbox." };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error.message, code: error.code };
  }
};

export default app;
