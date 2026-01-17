import { Link } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import { canManageUsers, canManageCompanySettings, canManageAllCompanies, UserRole } from '../utils/rbac';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const currentUser = getCurrentUser();
  const userRole = currentUser?.role as UserRole;

  return (
    <div className={styles.container}>
      <h2>Dashboard</h2>
      <p className={styles.subtitle}>Welcome to the Event Monitoring Platform</p>

      <div className={styles.cards}>
        {/* Operators see event monitoring cards */}
        {userRole === 'operator' && (
          <>
            <Link to="/operator" className={styles.card}>
              <span className={styles.cardIcon}>🗺️</span>
              <h3>Operator Dashboard</h3>
              <p>Interactive map and event monitoring</p>
            </Link>

            <Link to="/events" className={styles.card}>
              <span className={styles.cardIcon}>🚨</span>
              <h3>Events</h3>
              <p>Monitor and manage incidents</p>
            </Link>

            <Link to="/reports" className={styles.card}>
              <span className={styles.cardIcon}>📝</span>
              <h3>Reports</h3>
              <p>View all incoming reports</p>
            </Link>

            <Link to="/cameras" className={styles.card}>
              <span className={styles.cardIcon}>📹</span>
              <h3>Cameras</h3>
              <p>Live video streams</p>
            </Link>
          </>
        )}

        {/* Admins see user management and settings */}
        {canManageUsers(userRole) && (
          <Link to="/users" className={styles.card}>
            <span className={styles.cardIcon}>👥</span>
            <h3>User Management</h3>
            <p>Create, edit, and manage users</p>
          </Link>
        )}

        {canManageCompanySettings(userRole) && (
          <Link to="/company-settings" className={styles.card}>
            <span className={styles.cardIcon}>⚙️</span>
            <h3>Company Settings</h3>
            <p>Configure company settings and API keys</p>
          </Link>
        )}

        {/* Super Admin sees companies */}
        {canManageAllCompanies(userRole) && (
          <Link to="/companies" className={styles.card}>
            <span className={styles.cardIcon}>🏢</span>
            <h3>Companies</h3>
            <p>Manage all platform companies</p>
          </Link>
        )}
      </div>

      <div className={styles.placeholder}>
        <h3>Recently Implemented</h3>
        <ul>
          <li>✅ Interactive map with event markers</li>
          <li>✅ Real-time event list with live updates</li>
          <li>✅ Operator Dashboard with map view</li>
        </ul>
        <h3>Coming Soon</h3>
        <ul>
          <li>Live video preview grid</li>
          <li>First responder location tracking</li>
          <li>Event analytics and reporting</li>
        </ul>
      </div>
    </div>
  );
}
