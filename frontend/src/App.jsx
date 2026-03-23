import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import GroupPage from './pages/GroupPage.jsx';
import HomePage from './pages/HomePage.jsx';

// Reads token fresh on every render so navigation works immediately after login
function RequireAuth({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/groups" element={<RequireAuth><GroupPage /></RequireAuth>} />
      <Route path="/app"    element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="*" element={<Navigate to={localStorage.getItem('token') ? '/groups' : '/login'} replace />} />
    </Routes>
  );
}
