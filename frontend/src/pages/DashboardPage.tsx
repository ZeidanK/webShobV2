import styles from './DashboardPage.module.css';

export function DashboardPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Event Monitoring Dashboard</h1>
        <div className={styles.userInfo}>
          <span>Operator</span>
          <button className={styles.logoutButton}>Logout</button>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <a href="#" className={styles.navItem}>
              📊 Dashboard
            </a>
            <a href="#" className={styles.navItem}>
              🗺️ Map View
            </a>
            <a href="#" className={styles.navItem}>
              📋 Events
            </a>
            <a href="#" className={styles.navItem}>
              📝 Reports
            </a>
            <a href="#" className={styles.navItem}>
              📹 Cameras
            </a>
            <a href="#" className={styles.navItem}>
              👥 Users
            </a>
            <a href="#" className={styles.navItem}>
              ⚙️ Settings
            </a>
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.placeholder}>
            <h2>Dashboard Coming Soon</h2>
            <p>
              This dashboard will include:
            </p>
            <ul>
              <li>Interactive map with event and camera markers</li>
              <li>Real-time event list with filtering</li>
              <li>Quick actions for event management</li>
              <li>Live video preview</li>
              <li>First responder locations</li>
            </ul>
            <p className={styles.note}>
              Implementation begins in Slice 6 (Map & Dashboard UI)
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
