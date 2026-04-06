/**
 * Firebase client SDK (Auth, etc.).
 * Used by the frontend for sign-in, sign-up, and auth state.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBsZkC7cJlhNw-Nhc0JcqWT5OJkORIMsyM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'new-api-a316d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'new-api-a316d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'new-api-a316d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '516791847205',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:516791847205:web:459790f00163a30766b2cc',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
