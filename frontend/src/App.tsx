import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import EventsPage from './pages/EventsPage';
import ReportsPage from './pages/ReportsPage';
import ReportSubmissionPage from './pages/ReportSubmissionPage';
import ReportDetailPage from './pages/ReportDetailPage';
import CamerasPage from './pages/CamerasPage';

function App() {
  // Use state to track authentication - only update when explicitly changed
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('accessToken');
  });
  const location = useLocation();

  // Re-check auth when navigating (in case token was added/removed)
  useEffect(() => {
    const hasToken = !!localStorage.getItem('accessToken');
    if (hasToken !== isAuthenticated) {
      setIsAuthenticated(hasToken);
    }
  }, [location.pathname, isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* Operator+ routes */}
        <Route 
          path="events" 
          element={
            <ProtectedRoute requiredRole="operator">
              <EventsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="reports" 
          element={
            <ProtectedRoute requiredRole="citizen">
              <ReportsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="reports/new" 
          element={
            <ProtectedRoute requiredRole="citizen">
              <ReportSubmissionPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="reports/:id" 
          element={
            <ProtectedRoute requiredRole="citizen">
              <ReportDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="cameras" 
          element={
            <ProtectedRoute requiredRole="operator">
              <CamerasPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin+ routes */}
        <Route 
          path="users" 
          element={
            <ProtectedRoute requiredRole="admin">
              <UsersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="company-settings" 
          element={
            <ProtectedRoute requiredRole="admin">
              <CompanySettingsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Super Admin only routes */}
        <Route 
          path="companies" 
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <CompaniesPage />
            </ProtectedRoute>
          } 
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
