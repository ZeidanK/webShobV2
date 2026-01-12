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
import EventDetailPage from './pages/EventDetailPage';
import EventFormPage from './pages/EventFormPage';
import SuperAdminEventsPage from './pages/SuperAdminEventsPage';
import ReportsPage from './pages/ReportsPage';
import ReportSubmissionPage from './pages/ReportSubmissionPage';
import ReportDetailPage from './pages/ReportDetailPage';
import CamerasPage from './pages/CamerasPage';
import { websocketService } from './services/websocket';
import { ToastContainer, useToast } from './components/Toast';
import { useEventCreated, useReportCreated } from './hooks/useWebSocket';

function App() {
  // Use state to track authentication - only update when explicitly changed
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('accessToken');
  });
  const location = useLocation();
  const toast = useToast();

  // Re-check auth when navigating (in case token was added/removed)
  useEffect(() => {
    const hasToken = !!localStorage.getItem('accessToken');
    if (hasToken !== isAuthenticated) {
      setIsAuthenticated(hasToken);
    }
  }, [location.pathname, isAuthenticated]);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    if (isAuthenticated && token) {
      // Connect to WebSocket
      websocketService.connect(token);
      
      return () => {
        // Disconnect on unmount or auth change
        websocketService.disconnect();
      };
    } else {
      // Disconnect if not authenticated
      websocketService.disconnect();
    }
  }, [isAuthenticated]);

  // Listen for real-time event updates
  useEventCreated((event) => {
    toast.info('New Event', `${event.title} - ${event.priority} priority`);
  });

  // Listen for real-time report updates
  useReportCreated((report) => {
    toast.info('New Report', `${report.title} from ${report.reporterName}`);
  });

  return (
    <>
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
            <ProtectedRoute allowedRoles={['operator', 'admin', 'company_admin', 'super_admin']}>
              <EventsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="events/new" 
          element={
            <ProtectedRoute allowedRoles={['operator', 'admin', 'company_admin', 'super_admin']}>
              <EventFormPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="events/:id" 
          element={
            <ProtectedRoute allowedRoles={['operator', 'admin', 'company_admin', 'super_admin']}>
              <EventDetailPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="events/:id/edit" 
          element={
            <ProtectedRoute allowedRoles={['operator', 'admin', 'company_admin', 'super_admin']}>
              <EventFormPage />
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
          path="admin/events" 
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SuperAdminEventsPage />
            </ProtectedRoute>
          } 
        />
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
    <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} />
    </>
  );
}

export default App;
