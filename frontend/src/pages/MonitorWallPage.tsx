import React, { useState, useEffect, useCallback } from 'react';
import { CameraGrid, CameraItem } from '../components/CameraGrid';
import { api } from '../services/api';
import styles from './MonitorWallPage.module.css';

type GridSize = '2x2' | '3x3' | '4x4';

export default function MonitorWallPage() {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>('2x2');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.cameras.list({ status: 'online' });
      const cameraItems = await Promise.all(
        (response || []).map(async (camera) => {
          let streamUrl = camera.streamUrl;
          if (!streamUrl && camera.vms?.serverId) {
            try {
              const streams = await api.cameras.getStreams(camera._id);
              streamUrl = streams.hls || streams.raw || streams.embed || streams.snapshot;
            } catch (err) {
              console.error('Failed to load camera streams:', err);
            }
          }

          return {
            id: camera._id,
            name: camera.name,
            streamUrl,
            status: camera.status,
          } as CameraItem;
        })
      );
      setCameras(cameraItems);
    } catch (err: any) {
      console.error('Failed to load cameras:', err);
      setError(err.message || 'Failed to load cameras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  const gridSizeMap: Record<GridSize, number> = {
    '2x2': 4,
    '3x3': 9,
    '4x4': 16,
  };

  const displayCameras = cameras.slice(0, gridSizeMap[gridSize]);
  const onlineCameras = cameras.filter((c) => c.status === 'online');

  if (loading && cameras.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading cameras...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Monitor Wall</h1>
        <div className={styles.controls}>
          <label>
            <span>Grid Size:</span>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value as GridSize)}
              className={styles.select}
            >
              <option value="2x2">2×2 (4 cameras)</option>
              <option value="3x3">3×3 (9 cameras)</option>
              <option value="4x4">4×4 (16 cameras)</option>
            </select>
          </label>
          <button onClick={fetchCameras} className={styles.refreshBtn} title="Refresh cameras">
            🔄 Refresh
          </button>
          <div className={styles.status}>
            <span className={styles.statusOnline}>{onlineCameras.length}</span>
            <span className={styles.statusDivider}>/</span>
            <span>{cameras.length}</span>
            <span className={styles.statusLabel}>Online</span>
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
        </div>
      )}

      {!loading && displayCameras.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📹</div>
          <div className={styles.emptyTitle}>No cameras available</div>
          <div className={styles.emptyText}>
            Add online cameras to start monitoring.
          </div>
        </div>
      ) : (
        <div className={styles.gridWrapper}>
          <CameraGrid cameras={displayCameras} columns={parseInt(gridSize[0])} />
        </div>
      )}
    </div>
  );
}
