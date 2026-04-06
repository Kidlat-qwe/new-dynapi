import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { fetchWithToken } from '@/lib/api';

const AUTH_ROLE_KEY = 'auth_role';

function getStoredRole(uid) {
  try {
    const key = uid ? `${AUTH_ROLE_KEY}_${uid}` : AUTH_ROLE_KEY;
    return localStorage.getItem(key) || 'user';
  } catch {
    return 'user';
  }
}

function setStoredRole(uid, role) {
  try {
    const key = uid ? `${AUTH_ROLE_KEY}_${uid}` : AUTH_ROLE_KEY;
    localStorage.setItem(key, role || 'user');
  } catch {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setUserFromDb = useCallback(async (firebaseUser, fallbackRole) => {
    const role = fallbackRole ?? getStoredRole(firebaseUser.uid);
    let roleFromDb = role;
    let fname = '';
    let lname = '';
    try {
      const idToken = await firebaseUser.getIdToken(true);
      if (!idToken) {
        setUser({
          uid: firebaseUser.uid,
          firebase_uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          fname: '',
          lname: '',
          role,
        });
        return;
      }
      const me = await fetchWithToken('/api/users/me', { method: 'GET' }, idToken);
      roleFromDb = me.role || role;
      fname = me.fname ?? '';
      lname = me.lname ?? '';
    } catch (err) {
      // User not in DB (404) or backend down - retry sync to create/update in PostgreSQL
      if (err.status === 404 || err.message?.includes('not found')) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const parts = (firebaseUser.displayName || '').trim().split(/\s+/);
          const f = parts[0] || '';
          const l = parts.slice(1).join(' ') || '';
          const syncData = await fetchWithToken('/api/users/sync', {
            method: 'POST',
            body: { fname: f, lname: l, role },
          }, idToken);
          roleFromDb = syncData.role || role;
          fname = syncData.fname ?? '';
          lname = syncData.lname ?? '';
        } catch {
          roleFromDb = role;
        }
      } else {
        roleFromDb = role;
      }
    }
    setUser({
      uid: firebaseUser.uid,
      firebase_uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      fname,
      lname,
      role: roleFromDb,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await setUserFromDb(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUserFromDb]);

  const login = useCallback(async (email, password) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    let role = getStoredRole(firebaseUser.uid);
    /** @type {{ fname?: string; lname?: string; role?: string } | null} */
    let syncData = null;
    try {
      const idToken = await firebaseUser.getIdToken();
      // Sync with empty role so DB role is not overwritten (only last_login updated)
      syncData = await fetchWithToken('/api/users/sync', { method: 'POST', body: { role: '' } }, idToken);
      role = syncData.role || role;
      setStoredRole(firebaseUser.uid, role);
    } catch {
      setStoredRole(firebaseUser.uid, role);
    }
    const userState = {
      uid: firebaseUser.uid,
      firebase_uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      fname: syncData?.fname ?? '',
      lname: syncData?.lname ?? '',
      role,
    };
    setUser(userState);
    return userState;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const getToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    getToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
