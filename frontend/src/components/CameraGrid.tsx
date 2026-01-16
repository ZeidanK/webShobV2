/**
 * CameraGrid Component
 * 
 * Displays multiple camera live views in a responsive grid layout.
 * Supports different layout modes and camera selection.
 */

import React, { useState, useMemo } from 'react';
import { LiveView } from './LiveView';
import styles from './CameraGrid.module.css';

export interface CameraItem {
  id: string;
  name: string;
  streamUrl?: string;
  snapshotUrl?: string;
  status?: 'online' | 'offline' | 'error' | 'maintenance';
}

interface CameraGridProps {
  /** List of cameras to display */
  cameras: CameraItem[];
  
  /** Grid layout mode */
  layout?: '1x1' | '2x2' | '3x3' | '4x4' | 'auto';
  
  /** Callback when camera is selected */
  onCameraSelect?: (camera: CameraItem) => void;
  
  /** Currently selected camera ID */
  selectedCameraId?: string;
  
  /** Show camera status indicators */
  showStatus?: boolean;
  
  /** Optional CSS class */
  className?: string;
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  cameras,
  layout = 'auto',
  onCameraSelect,
  selectedCameraId,
  showStatus = true,
  className,
}) => {
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);

  // Calculate grid columns based on layout and camera count
  const gridColumns = useMemo(() => {
    if (layout === 'auto') {
      const count = cameras.length;
      if (count === 1) return 1;
      if (count <= 4) return 2;
      if (count <= 9) return 3;
      return 4;
    }
    
    switch (layout) {
      case '1x1': return 1;
      case '2x2': return 2;
      case '3x3': return 3;
      case '4x4': return 4;
      default: return 2;
    }
  }, [layout, cameras.length]);

  // Filter cameras with streams
  const camerasWithStreams = useMemo(() => {
    return cameras.filter(c => c.streamUrl);
  }, [cameras]);

  // Handle camera click
  const handleCameraClick = (camera: CameraItem) => {
    if (focusedCameraId === camera.id) {
      setFocusedCameraId(null);
    } else {
      setFocusedCameraId(camera.id);
    }
    onCameraSelect?.(camera);
  };

  // Handle double-click for fullscreen focus
  const handleDoubleClick = (camera: CameraItem) => {
    setFocusedCameraId(prev => prev === camera.id ? null : camera.id);
  };

  // Render focused camera view
  if (focusedCameraId) {
    const focusedCamera = cameras.find(c => c.id === focusedCameraId);
    if (focusedCamera && focusedCamera.streamUrl) {
      return (
        <div className={`${styles.container} ${styles.focused} ${className || ''}`}>
          <div className={styles.focusedView}>
            <button 
              className={styles.exitFocusButton}
              onClick={() => setFocusedCameraId(null)}
              title="Exit fullscreen"
            >
              ✕ Exit Fullscreen
            </button>
            <LiveView
              streamUrl={focusedCamera.streamUrl}
              cameraName={focusedCamera.name}
              snapshotUrl={focusedCamera.snapshotUrl}
              aspectRatio="16:9"
            />
          </div>
          
          {/* Thumbnail strip */}
          <div className={styles.thumbnailStrip}>
            {camerasWithStreams.map(camera => (
              <button
                key={camera.id}
                className={`${styles.thumbnail} ${camera.id === focusedCameraId ? styles.active : ''}`}
                onClick={() => setFocusedCameraId(camera.id)}
              >
                {camera.snapshotUrl ? (
                  <img src={camera.snapshotUrl} alt={camera.name} />
                ) : (
                  <div className={styles.thumbnailPlaceholder}>
                    <span>{camera.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <span className={styles.thumbnailName}>{camera.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {cameras.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📹</span>
          <h3>No cameras configured</h3>
          <p>Add cameras or connect to a VMS server to view live streams.</p>
        </div>
      ) : (
        <div 
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
        >
          {cameras.map(camera => (
            <div
              key={camera.id}
              className={`${styles.gridItem} ${selectedCameraId === camera.id ? styles.selected : ''}`}
              onClick={() => handleCameraClick(camera)}
              onDoubleClick={() => handleDoubleClick(camera)}
            >
              {camera.streamUrl ? (
                <LiveView
                  streamUrl={camera.streamUrl}
                  cameraName={camera.name}
                  snapshotUrl={camera.snapshotUrl}
                  showControls={false}
                  autoPlay={true}
                />
              ) : (
                <div className={styles.offline}>
                  <span className={styles.offlineIcon}>📵</span>
                  <span className={styles.cameraName}>{camera.name}</span>
                  {showStatus && camera.status && (
                    <span className={`${styles.statusBadge} ${styles[camera.status]}`}>
                      {camera.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraGrid;
