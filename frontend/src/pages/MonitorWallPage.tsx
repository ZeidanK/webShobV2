// TEST-ONLY: Use named hooks to avoid unused default React import.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraGrid, CameraItem } from '../components/CameraGrid';
import { api, CameraStatus } from '../services/api';
import { useCameraStatus } from '../hooks/useWebSocket';
import styles from './MonitorWallPage.module.css';

type GridSize = '2x2' | '3x3' | '4x4';
type WallInteractionMode = 'both' | 'click' | 'drag';
type WallSettings = {
  interactionMode: WallInteractionMode;
};
type NearbyCameraContext = {
  centerLat: number;
  centerLng: number;
  radius: number;
  eventId: string;
  eventTitle: string;
  cameraIds: string[];
  timestamp: string;
};

const wallSettingsKey = 'monitorWall.settings';
const nearbyCameraContextKey = 'nearbyCameraContext';

const loadWallSettings = (): WallSettings => {
  // TEST-ONLY: Persist per-operator wall settings locally for phase 1.
  try {
    const stored = localStorage.getItem(wallSettingsKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<WallSettings>;
      if (parsed.interactionMode) {
        return { interactionMode: parsed.interactionMode };
      }
    }
  } catch (err) {
    console.warn('Failed to load monitor wall settings:', err);
  }

  return { interactionMode: 'both' };
};

export default function MonitorWallPage() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>('2x2');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallSettings, setWallSettings] = useState<WallSettings>(() => loadWallSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gridResetToken, setGridResetToken] = useState(0);
  const [nearbyContext, setNearbyContext] = useState<NearbyCameraContext | null>(null);
  const [nearbyMode, setNearbyMode] = useState(false);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const [gridViewportHeight, setGridViewportHeight] = useState<number | null>(null);

  const updateWallSettings = useCallback((updates: Partial<WallSettings>) => {
    // TEST-ONLY: Keep settings changes local for operator-level customization.
    setWallSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(wallSettingsKey, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save monitor wall settings:', err);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // Load nearby camera context from event radius selection
    try {
      const stored = sessionStorage.getItem(nearbyCameraContextKey);
      if (stored) {
        const parsed = JSON.parse(stored) as NearbyCameraContext;
        setNearbyContext(parsed);
        setNearbyMode(true);
        // Clear context after loading so it doesn't persist on refresh
        sessionStorage.removeItem(nearbyCameraContextKey);
      }
    } catch (err) {
      console.warn('Failed to load nearby camera context:', err);
      sessionStorage.removeItem(nearbyCameraContextKey);
    }
  }, []);

  const mergeCameras = useCallback((nextCameras: CameraItem[]) => {
    // TEST-ONLY: Preserve operator order while refreshing camera status/streams.
    setCameras((prev) => {
      if (prev.length === 0) {
        return nextCameras;
      }
      const nextById = new Map(nextCameras.map((camera) => [camera.id, camera]));
      const preserved = prev
        .map((camera) => nextById.get(camera.id))
        .filter((camera): camera is CameraItem => Boolean(camera));
      const additions = nextCameras.filter((camera) => !prev.some((existing) => existing.id === camera.id));
      return [...preserved, ...additions];
    });
  }, []);

  const buildCameraItems = useCallback(async (cameraList: any[]) => {
    return Promise.all(
      (cameraList || []).map(async (camera) => {
        let streamUrl = camera.streamUrl;
        let embedUrl = camera.embedUrl;
        let snapshotUrl = camera.snapshotUrl;
        if (!streamUrl && (camera.vms?.serverId || camera.streamConfig?.type === 'direct-rtsp')) {
          try {
            const streams = await api.cameras.getStreams(camera._id);
            streamUrl = streams.hls || streams.raw || streams.embed || streams.snapshot;
            // TEST-ONLY: Preserve embed/snapshot URLs for fallback playback.
            embedUrl = streams.embed || embedUrl;
            snapshotUrl = streams.snapshot || snapshotUrl;
          } catch (err) {
            console.error('Failed to load camera streams:', err);
          }
        }

        return {
          id: camera._id,
          name: camera.name,
          streamUrl,
          embedUrl,
          snapshotUrl,
          status: camera.status,
          // TEST-ONLY: Track direct-rtsp streams for heartbeat support.
          streamType: camera.streamConfig?.type || (camera.vms?.serverId ? 'vms' : 'manual'),
          heartbeat: camera.streamConfig?.type === 'direct-rtsp'
            ? () => api.cameras.heartbeat(camera._id)
            : undefined,
        } as CameraItem;
      })
    );
  }, []);

  const fetchCameras = useCallback(async (replace = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.cameras.list();
      const cameraItems = await buildCameraItems(response || []);
      if (replace) {
        setCameras(cameraItems);
      } else {
        mergeCameras(cameraItems);
      }
    } catch (err: any) {
      console.error('Failed to load cameras:', err);
      setError(err.message || 'Failed to load cameras');
    } finally {
      setLoading(false);
    }
  }, [buildCameraItems, mergeCameras]);

  const loadNearbyCameras = useCallback(async (context: NearbyCameraContext, replace = false) => {
    if (!context?.centerLng || !context?.centerLat) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const nearby = await api.cameras.findNearby(
        context.centerLng,
        context.centerLat,
        context.radius,
        context.cameraIds.length || 16
      );
      const cameraItems = await buildCameraItems(nearby || []);
      if (replace) {
        setCameras(cameraItems);
      } else {
        mergeCameras(cameraItems);
      }
    } catch (err: any) {
      console.error('Failed to load nearby cameras:', err);
      setError(err.message || 'Failed to load nearby cameras');
    } finally {
      setLoading(false);
    }
  }, [buildCameraItems, mergeCameras]);

  useEffect(() => {
    if (nearbyMode && nearbyContext) {
      loadNearbyCameras(nearbyContext, true);
    } else {
      fetchCameras(true);
    }

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (nearbyMode && nearbyContext) {
        loadNearbyCameras(nearbyContext, true);
      } else {
        fetchCameras();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCameras, loadNearbyCameras, nearbyMode, nearbyContext]);

  // TEST-ONLY: Apply real-time status updates to the wall tiles.
  useCameraStatus((payload: { cameraId: string; status: CameraStatus }) => {
    if (!payload?.cameraId) {
      return;
    }
    setCameras((prev) =>
      prev.map((camera) =>
        camera.id === payload.cameraId ? { ...camera, status: payload.status } : camera
      )
    );
  });

  useEffect(() => {
    // TEST-ONLY: Reset session-only tile sizes when grid size changes.
    setGridResetToken((prev) => prev + 1);
  }, [gridSize]);

  useEffect(() => {
    // TEST-ONLY: Track wall viewport height for fixed NxN sizing with overflow scroll.
    const wrapper = gridWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const updateHeight = () => {
      setGridViewportHeight(wrapper.getBoundingClientRect().height);
    };
    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const handleSwap = useCallback((sourceId: string, targetId: string) => {
    // TEST-ONLY: Apply drag swaps to the local grid ordering.
    setCameras((prev) => {
      const sourceIndex = prev.findIndex((camera) => camera.id === sourceId);
      const targetIndex = prev.findIndex((camera) => camera.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return prev;
      }
      const next = [...prev];
      const temp = next[sourceIndex];
      next[sourceIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(async () => {
    // TEST-ONLY: Reset ordering and session-only tile sizes.
    setGridResetToken((prev) => prev + 1);
    if (nearbyMode && nearbyContext) {
      await loadNearbyCameras(nearbyContext, true);
    } else {
      await fetchCameras(true);
    }
  }, [fetchCameras, loadNearbyCameras, nearbyMode, nearbyContext]);

  const handleBackToMap = useCallback(() => {
    // Navigate back to the operator dashboard map
    navigate('/');
  }, [navigate]);

  const handleExitNearbyMode = useCallback(async () => {
    // Return to full camera wall
    sessionStorage.removeItem(nearbyCameraContextKey);
    setNearbyContext(null);
    setNearbyMode(false);
    await fetchCameras(true);
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
      {/* Event Context Banner */}
      {nearbyMode && nearbyContext && (
        <div className={styles.contextBanner}>
          <div className={styles.contextInfo}>
            <span className={styles.contextIcon}>📍</span>
            <div className={styles.contextText}>
              <strong>Event Context:</strong> {nearbyContext.eventTitle}
              <span className={styles.contextMeta}>
                • {nearbyContext.radius}m radius • {cameras.length} cameras nearby
              </span>
            </div>
          </div>
          <div className={styles.contextActions}>
            <button onClick={handleBackToMap} className={styles.backToMapBtn}>
              ← Back to Map
            </button>
            <button onClick={handleExitNearbyMode} className={styles.exitContextBtn}>
              ✕ Exit Context
            </button>
          </div>
        </div>
      )}
      
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
              <option value="2x2">2x2 (4 cameras)</option>
              <option value="3x3">3x3 (9 cameras)</option>
              <option value="4x4">4x4 (16 cameras)</option>
            </select>
          </label>
          {/* TEST-ONLY: Use ASCII-only labels to avoid mojibake in operator controls. */}
          {/* TEST-ONLY: Wrap refresh to avoid event-typed callback mismatch. */}
          <button
            onClick={() => fetchCameras()}
            className={styles.refreshBtn}
            title="Refresh cameras"
          >
            Refresh
          </button>
          <button onClick={handleResetLayout} className={styles.resetBtn} title="Reset wall layout">
            Reset Layout
          </button>
          {nearbyMode && (
            <button onClick={handleExitNearbyMode} className={styles.exitNearbyBtn} title="Exit nearby mode">
              Exit Nearby
            </button>
          )}
          <div className={styles.settings}>
            <button
              type="button"
              className={styles.settingsBtn}
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-expanded={settingsOpen}
              aria-haspopup="true"
            >
              Settings
            </button>
            {settingsOpen && (
              <div className={styles.settingsPanel}>
                <label className={styles.settingsRow}>
                  <span>Wall interaction</span>
                  <select
                    value={wallSettings.interactionMode}
                    onChange={(e) =>
                      updateWallSettings({ interactionMode: e.target.value as WallInteractionMode })
                    }
                    className={styles.select}
                  >
                    <option value="both">Click + drag</option>
                    <option value="click">Click only</option>
                    <option value="drag">Drag only</option>
                  </select>
                </label>
              </div>
            )}
          </div>
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
          {/* TEST-ONLY: Keep error copy ASCII to avoid encoding issues in the wall UI. */}
          Error: {error}
        </div>
      )}

      {!loading && cameras.length === 0 ? (
        <div className={styles.empty}>
          {/* TEST-ONLY: ASCII fallback for empty-state icon text. */}
          <div className={styles.emptyIcon}>No cameras</div>
          <div className={styles.emptyTitle}>No cameras available</div>
          <div className={styles.emptyText}>
            Add online cameras to start monitoring.
          </div>
        </div>
      ) : (
        <div className={styles.gridWrapper} ref={gridWrapperRef}>
          <CameraGrid
            cameras={cameras}
            columns={parseInt(gridSize.split('x')[0], 10)}
            rows={parseInt(gridSize.split('x')[1], 10)}
            viewportHeight={gridViewportHeight ?? undefined}
            interactionMode={wallSettings.interactionMode}
            onSwap={handleSwap}
            showStatus={true}
            resetToken={gridResetToken}
            // TEST-ONLY: Keep wall tiles in a scrollable container when overflow occurs.
            wallMode={true}
          />
        </div>
      )}
    </div>
  );
}






