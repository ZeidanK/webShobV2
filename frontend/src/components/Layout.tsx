import { Link, useNavigate, Outlet } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import { canManageUsers, canManageCompanySettings, canManageAllCompanies, UserRole } from '../utils/rbac';
import styles from './Layout.module.css';

export function Layout() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const userRole = currentUser?.role as UserRole;

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1>Event Monitoring Platform</h1>
        <div className={styles.userInfo}>
          <span>{currentUser.email} ({currentUser.role.replace('_', ' ')})</span>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <div className={styles.container}>
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link to="/dashboard" className={styles.navItem}>
              ���� Dashboard
            </Link>
            
            {/* Operators see Events & Reports (monitoring) */}
            {userRole === 'operator' && (
              <>
                <Link to="/events" className={styles.navItem}>
                  🚨 Events
                </Link>
                <Link to="/reports" className={styles.navItem}>
                  📝 Reports
                </Link>
                <Link to="/cameras" className={styles.navItem}>
                  📹 Cameras
                </Link>
              </>
            )}
            
            {/* Admins see User Management, Company Settings, and Cameras */}
            {canManageUsers(userRole) && (
              <Link to="/users" className={styles.navItem}>
                👥 Users
              </Link>
            )}
            
            {canManageCompanySettings(userRole) && (
              <Link to="/company-settings" className={styles.navItem}>
                ⚙️ Company Settings
              </Link>
            )}
            
            {/* Super Admin sees Companies */}
            {canManageAllCompanies(userRole) && (
              <Link to="/companies" className={styles.navItem}>
                🏢 Companies
              </Link>
            )}
          </nav>
        </aside>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
