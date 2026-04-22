import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userData && !allowedRoles.includes(userData.rol)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
