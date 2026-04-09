import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionProvider';

export function RoleRoute({ allow = [], redirectTo = '/dashboard', children }) {
  const location = useLocation();
  const { accessRole, isAdmin } = useSession();

  const hasAccess = allow === 'admin'
    ? isAdmin
    : Array.isArray(allow) && allow.length > 0
      ? allow.includes(accessRole)
      : true;

  if (hasAccess) {
    return children;
  }

  return <Navigate to={redirectTo} replace state={{ deniedFrom: location.pathname }} />;
}