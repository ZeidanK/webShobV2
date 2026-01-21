/**
 * MapContextMenu Component
 * 
 * Right-click context menu for the map with actions like:
 * - Create Event at location
 * - Add Camera at location
 * - Location information
 * 
 * Role-based menu items ensure users only see actions they have permission for.
 */

import { useNavigate } from 'react-router-dom';
import { UserRole } from '../services/api';
import styles from './MapContextMenu.module.css';

interface MapContextMenuProps {
  position: { x: number; y: number } | null;
  latLng: { lat: number; lng: number } | null;
  onClose: () => void;
  userRole?: UserRole;
}

interface MenuItem {
  label: string;
  icon: string;
  onClick: () => void;
  roles: UserRole[] | 'all';
  divider?: boolean;
}

export function MapContextMenu({
  position,
  latLng,
  onClose,
  userRole = 'operator',
}: MapContextMenuProps) {
  const navigate = useNavigate();

  if (!position || !latLng) {
    return null;
  }

  const handleCreateEvent = () => {
    navigate('/events/create', {
      state: {
        coordinates: [latLng.lng, latLng.lat],
        fromMap: true,
      },
    });
    onClose();
  };

  const handleAddCamera = () => {
    navigate('/cameras/add', {
      state: {
        coordinates: [latLng.lng, latLng.lat],
        fromMap: true,
      },
    });
    onClose();
  };

  const handleLocationInfo = () => {
    // Copy coordinates to clipboard
    const coords = `${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    alert(`Coordinates copied to clipboard:\n${coords}`);
    onClose();
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Create Event Here',
      icon: '🚨',
      onClick: handleCreateEvent,
      roles: ['operator', 'admin', 'company_admin', 'super_admin'],
    },
    {
      label: 'Add Camera',
      icon: '📹',
      onClick: handleAddCamera,
      roles: ['admin', 'company_admin', 'super_admin'],
    },
    {
      label: '',
      icon: '',
      onClick: () => {},
      roles: 'all',
      divider: true,
    },
    {
      label: 'Copy Coordinates',
      icon: '📍',
      onClick: handleLocationInfo,
      roles: 'all',
    },
  ];

  // Filter menu items based on user role
  const filteredItems = menuItems.filter((item) => {
    if (item.divider) return true;
    if (item.roles === 'all') return true;
    return item.roles.includes(userRole);
  });

  // Adjust position if menu would go off screen
  const adjustedStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
  };

  // Check if menu would go off right edge
  if (position.x + 200 > window.innerWidth) {
    adjustedStyle.left = position.x - 200;
  }

  // Check if menu would go off bottom edge
  if (position.y + 150 > window.innerHeight) {
    adjustedStyle.top = position.y - 150;
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div className={styles.backdrop} onClick={onClose} />
      
      {/* Context menu */}
      <div className={styles.contextMenu} style={adjustedStyle}>
        <div className={styles.menuHeader}>
          <div className={styles.coordinates}>
            📍 {latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)}
          </div>
        </div>
        
        {filteredItems.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} className={styles.divider} />;
          }
          
          return (
            <button
              key={index}
              className={styles.menuItem}
              onClick={item.onClick}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              <span className={styles.menuLabel}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
