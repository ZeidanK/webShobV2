import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CameraGrid, CameraItem } from '../components/CameraGrid';
import { api } from '../services/api';
import styles from './MonitorWallPage.module.css';

type GridSize = '2x2' | '3x3' | '4x4';
type WallInteractionMode = 'both' | 'click' | 'drag';
type WallSettings = {
  interactionMode: WallInteractionMode;
};
type NearbySelection = {
  eventId?: string;
  radius?: number;
  limit?: number;
  lng?: number;
  lat?: number;
  cameras?: any[];
  createdAt?: string;
};

const wallSettingsKey = 'monitorWall.settings';
const nearbySelectionKey = 'monitorWall.nearby';

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
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [gridSize, setGridSize] = useState<GridSize>('2x2');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallSettings, setWallSettings] = useState<WallSettings>(() => loadWallSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gridResetToken, setGridResetToken] = useState(0);
  const [nearbySelection, setNearbySelection] = useState<NearbySelection | null>(null);
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
    // TEST-ONLY: Load nearby selection for the current operator session.
    try {
      const stored = sessionStorage.getItem(nearbySelectionKey);
      if (stored) {
        const parsed = JSON.parse(stored) as NearbySelection;
        setNearbySelection(parsed);
        setNearbyMode(true);
      }
    } catch (err) {
      console.warn('Failed to load nearby camera selection:', err);
      sessionStorage.removeItem(nearbySelectionKey);
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

  const loadNearbyCameras = useCallback(async (selection: NearbySelection, replace = false) => {
    if (!selection?.lng || !selection?.lat) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const nearby = await api.cameras.findNearby(
        selection.lng,
        selection.lat,
        selection.radius,
        selection.limit
      );
      const cameraItems = await buildCameraItems(nearby || selection.cameras || []);
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
    if (nearbyMode && nearbySelection) {
      loadNearbyCameras(nearbySelection, true);
    } else {
      fetchCameras(true);
    }

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (nearbyMode && nearbySelection) {
        loadNearbyCameras(nearbySelection, true);
      } else {
        fetchCameras();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCameras, loadNearbyCameras, nearbyMode, nearbySelection]);

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
    if (nearbyMode && nearbySelection) {
      await loadNearbyCameras(nearbySelection, true);
    } else {
      await fetchCameras(true);
    }
  }, [fetchCameras, loadNearbyCameras, nearbyMode, nearbySelection]);

  const handleExitNearbyMode = useCallback(async () => {
    // TEST-ONLY: Return to the full wall without changing layout settings.
    sessionStorage.removeItem(nearbySelectionKey);
    setNearbySelection(null);
    setNearbyMode(false);
    await fetchCameras(true);
  }, [fetchCameras]);

  // TEST-ONLY: Show all cameras and rely on wall scroll for overflow beyond the grid size.
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
              <option value="2x2">2x2 (4 cameras)</option>
              <option value="3x3">3x3 (9 cameras)</option>
              <option value="4x4">4x4 (16 cameras)</option>
            </select>
          </label>
          {/* TEST-ONLY: Use ASCII-only labels to avoid mojibake in operator controls. */}
          <button onClick={fetchCameras} className={styles.refreshBtn} title="Refresh cameras">
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





