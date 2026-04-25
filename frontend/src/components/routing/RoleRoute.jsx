import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionProvider';

export function RoleRoute({ allow = [], redirectTo = '/dashboard', children }) {
  const location = useLocation();
  const { accessRole, isAdmin } = useSession();

  // Dynamic redirect (from jim_branch) with default fallback (from main)
  const resolvedRedirect = redirectTo
    ? redirectTo
    : (accessRole === 'STUDENT'
        ? '/student-portal'
        : accessRole === 'FACULTY'
          ? '/faculty'
          : '/dashboard');

  const hasAccess = allow === 'admin'
    ? isAdmin
    : Array.isArray(allow) && allow.length > 0
      ? allow.includes(accessRole)
      : true;

  if (hasAccess) {
    return children;
  }

  return (
    <Navigate
      to={resolvedRedirect}
      replace
      state={{ deniedFrom: location.pathname }}
    />
  );
}
