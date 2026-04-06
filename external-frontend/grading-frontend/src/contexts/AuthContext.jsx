import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, isFirebaseConfigured } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

/** Build a minimal user-like object from API login (localStorage) for useAuth().currentUser */
function getApiSessionUser() {
  try {
    const token = localStorage.getItem('userToken');
    const userDataRaw = localStorage.getItem('userData');
    if (!token || !userDataRaw) return null;
    const userData = JSON.parse(userDataRaw);
    return {
      uid: String(userData.user_id),
      email: userData.email || userData.username || '',
      emailVerified: true,
    };
  } catch {
    return null;
  }
}

/** Clear API session (localStorage) */
export function clearApiSession() {
  localStorage.removeItem('userToken');
  localStorage.removeItem('userType');
  localStorage.removeItem('userId');
  localStorage.removeItem('userData');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearApiSession();
    setCurrentUser(null);
  };

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setCurrentUser(user);
        setLoading(false);
      });
      return unsubscribe;
    }
    // No Firebase: restore session from localStorage (API login)
    const apiUser = getApiSessionUser();
    setCurrentUser(apiUser);
    setLoading(false);
    return () => {};
  }, []);

  const value = {
    currentUser,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
