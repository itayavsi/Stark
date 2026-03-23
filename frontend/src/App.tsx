import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import GroupPage from './pages/GroupPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/groups"
        element={
          <RequireAuth>
            <GroupPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/groups' : '/login'} replace />}
      />
    </Routes>
  );
}
