import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SessionContext = createContext(null);

function normalizeRole(role) {
  if (!role || typeof role !== 'string') {
    return 'FACULTY';
  }

  const normalized = role.trim().toUpperCase();
  return normalized || 'FACULTY';
}

function readStoredUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawUser = localStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [accessRole, setAccessRole] = useState(() => normalizeRole(readStoredUser()?.role));

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      setAccessRole(normalizeRole(user.role));
      return;
    }

    localStorage.removeItem('user');
    setAccessRole('FACULTY');
  }, [user]);

  const isAdmin = accessRole === 'DEAN';
  const viewMode = isAdmin ? 'Admin' : 'User';

  const value = useMemo(() => ({
    user,
    setUser,
    accessRole,
    setAccessRole,
    isAdmin,
    viewMode,
  }), [user, accessRole, isAdmin, viewMode]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}