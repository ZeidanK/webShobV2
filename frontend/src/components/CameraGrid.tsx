/**
 * CameraGrid Component
 * 
 * Displays multiple camera live views in a responsive grid layout.
 * Supports different layout modes and camera selection.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LiveView } from './LiveView';
import styles from './CameraGrid.module.css';

export interface CameraItem {
  id: string;
  name: string;
  streamUrl?: string;
  // TEST-ONLY: Provide an embed URL for non-HLS fallback playback.
  embedUrl?: string;
  snapshotUrl?: string;
  status?: 'online' | 'offline' | 'error' | 'maintenance';
  // TEST-ONLY: Track stream type for direct-rtsp heartbeat wiring.
  streamType?: 'direct-rtsp' | 'vms' | 'manual';
  // TEST-ONLY: Optional heartbeat callback for direct-rtsp playback.
  heartbeat?: () => Promise<void>;
}

interface CameraGridProps {
  /** List of cameras to display */
  cameras: CameraItem[];
  
  /** Grid layout mode */
  layout?: '1x1' | '2x2' | '3x3' | '4x4' | 'auto';

  /** Explicit column count for wall grid sizing */
  columns?: number;

  /** Explicit row count for fixed wall sizing */
  rows?: number;

  /** Wall viewport height for fixed row sizing */
  viewportHeight?: number;
  
  /** Callback when camera is selected */
  onCameraSelect?: (camera: CameraItem) => void;
  
  /** Currently selected camera ID */
  selectedCameraId?: string;
  
  /** Show camera status indicators */
  showStatus?: boolean;
  
  /** Interaction mode for operator wall */
  interactionMode?: 'both' | 'click' | 'drag';
  
  /** Callback when cameras are swapped via drag */
  onSwap?: (sourceId: string, targetId: string) => void;

  /** Reset token for clearing session-only layout state */
  resetToken?: number;
  
  /** Optional CSS class */
  className?: string;

  /** Enable wall layout mode for scrollable grids */
  wallMode?: boolean;
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  cameras,
  layout = 'auto',
  columns,
  rows,
  viewportHeight,
  onCameraSelect,
  selectedCameraId,
  showStatus = true,
  interactionMode = 'both',
  onSwap,
  resetToken,
  className,
  wallMode = false,
}) => {
  // TEST-ONLY: Allow monitor wall to opt into a scroll-friendly container.
  const containerClassName = `${styles.container} ${wallMode ? styles.wallContainer : ''} ${
    className || ''
  }`;
  const [focusedCameraId, setFocusedCameraId] = useState<string | null>(null);
  const [draggingCameraId, setDraggingCameraId] = useState<string | null>(null);
  const [dragOverCameraId, setDragOverCameraId] = useState<string | null>(null);
  const [hoverResizeId, setHoverResizeId] = useState<string | null>(null);
  const resizeDragRef = useRef<{
    id: string;
    x: number;
    y: number;
    startWidth: number;
    startHeight: number;
    direction: 'e' | 's' | 'se' | 'ne' | 'sw' | 'nw';
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [tileSizes, setTileSizes] = useState<Record<string, { width: number; height: number }>>({});

  // TEST-ONLY: Reset session-only tile sizes when the grid size changes.
  useEffect(() => {
    setTileSizes({});
  }, [resetToken]);

  // TEST-ONLY: Minimum size keeps tiles usable while allowing free resize.
  const minTileWidth = 240;
  const minTileHeight = 135;

  // TEST-ONLY: Allow wall interactions to switch between click, drag, or both.
  const allowsClick = interactionMode !== 'drag';
  const allowsDrag = interactionMode !== 'click';

  // TEST-ONLY: Fixed wall sizing keeps tiles aligned to the selected NxN grid.
  const baseTileHeight = useMemo(() => {
    if (!rows || rows <= 0 || !viewportHeight) {
      return null;
    }
    const gridPadding = 8;
    const gridGap = 4;
    const available = viewportHeight - gridPadding - (rows - 1) * gridGap;
    const computed = Math.floor(available / rows);
    return Math.max(minTileHeight, computed);
  }, [rows, viewportHeight, minTileHeight]);

  // Calculate grid columns based on layout and camera count
  const gridColumns = useMemo(() => {
    // TEST-ONLY: Respect explicit wall column sizing when provided.
    if (columns && columns > 0) {
      return columns;
    }
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
  }, [layout, cameras.length, columns]);

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

  const handleDragStart = (camera: CameraItem, event: React.DragEvent<HTMLDivElement>) => {
    if (!allowsDrag) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const resizeEdge = target?.closest('[data-resize-edge="true"]');
    if (resizeEdge) {
      return;
    }
    // TEST-ONLY: Track source camera to enable local swaps in the wall grid.
    setDraggingCameraId(camera.id);
    event.dataTransfer.setData('text/plain', camera.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (camera: CameraItem, event: React.DragEvent<HTMLDivElement>) => {
    if (!allowsDrag) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverCameraId(camera.id);
  };

  const handleDragLeave = (camera: CameraItem) => {
    if (dragOverCameraId === camera.id) {
      setDragOverCameraId(null);
    }
  };

  const handleDrop = (camera: CameraItem, event: React.DragEvent<HTMLDivElement>) => {
    if (!allowsDrag) {
      return;
    }
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== camera.id) {
      onSwap?.(sourceId, camera.id);
    }
    setDraggingCameraId(null);
    setDragOverCameraId(null);
  };

  const handleDragEnd = () => {
    setDraggingCameraId(null);
    setDragOverCameraId(null);
  };

  const handleResizePointerDown = (
    cameraId: string,
    direction: 'e' | 's' | 'se' | 'ne' | 'sw' | 'nw',
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!allowsDrag) {
      return;
    }
    const tile = tileRefs.current[cameraId];
    if (!tile) {
      return;
    }
    const rect = tile.getBoundingClientRect();
    // TEST-ONLY: Track pointer deltas for per-tile size updates.
    resizeDragRef.current = {
      id: cameraId,
      x: event.clientX,
      y: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      direction,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowsDrag) {
      return;
    }
    const start = resizeDragRef.current;
    if (!start) {
      return;
    }
    // TEST-ONLY: Use the active resize target for pointer updates.
    const cameraId = start.id;
    const gridRect = gridRef.current?.getBoundingClientRect();
    const maxWidth = gridRect ? Math.max(gridRect.width - 8, minTileWidth) : Infinity;
    const maxHeight = gridRect ? Math.max(gridRect.height * 2, minTileHeight) : Infinity;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const direction = start.direction;
    const widthDelta = direction.includes('w') ? -deltaX : deltaX;
    const heightDelta = direction.includes('n') ? -deltaY : deltaY;
    const nextWidth = Math.min(
      Math.max(start.startWidth + widthDelta, minTileWidth),
      maxWidth
    );
    const nextHeight = Math.min(
      Math.max(start.startHeight + heightDelta, minTileHeight),
      maxHeight
    );
    // TEST-ONLY: Update tile size live while dragging.
    setTileSizes((prev) => ({
      ...prev,
      [cameraId]: { width: nextWidth, height: nextHeight },
    }));
    event.preventDefault();
    event.stopPropagation();
  };

  // TEST-ONLY: End a resize drag without per-camera arguments.
  const handleResizePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowsDrag) {
      return;
    }
    resizeDragRef.current = null;
    event.preventDefault();
    event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const handleResizePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeDragRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleResizeClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  // Render focused camera view
  if (focusedCameraId) {
    const focusedCamera = cameras.find(c => c.id === focusedCameraId);
    if (focusedCamera && focusedCamera.streamUrl) {
      return (
        <div className={`${containerClassName} ${styles.focused}`}>
          <div className={styles.focusedView}>
            {/* TEST-ONLY: Keep fullscreen control label ASCII to avoid mojibake. */}
            <button 
              className={styles.exitFocusButton}
              onClick={() => setFocusedCameraId(null)}
              title="Exit fullscreen"
            >
              Exit Fullscreen
            </button>
            <LiveView
              streamUrl={focusedCamera.streamUrl}
              embedUrl={focusedCamera.embedUrl}
              cameraName={focusedCamera.name}
              snapshotUrl={focusedCamera.snapshotUrl}
              aspectRatio="16:9"
              onHeartbeat={focusedCamera.streamType === 'direct-rtsp' ? focusedCamera.heartbeat : undefined}
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
    <div className={containerClassName}>
      {cameras.length === 0 ? (
        <div className={styles.empty}>
          {/* TEST-ONLY: ASCII fallback for the empty-state icon label. */}
          <span className={styles.emptyIcon}>No cameras</span>
          <h3>No cameras configured</h3>
          <p>Add cameras or connect to a VMS server to view live streams.</p>
        </div>
      ) : (
        <div
          className={styles.grid}
          ref={gridRef}
          style={{ '--grid-columns': gridColumns } as React.CSSProperties}
        >
          {cameras.map(camera => {
            const tileSize = tileSizes[camera.id];
            // TEST-ONLY: Use fixed wall sizing unless an operator resized this tile.
            const tileStyle = tileSize
              ? { width: `${tileSize.width}px`, height: `${tileSize.height}px` }
              : baseTileHeight
              ? { height: `${baseTileHeight}px` }
              : undefined;

            return (
              <div
                key={camera.id}
                ref={(node) => {
                  tileRefs.current[camera.id] = node;
                }}
                className={`${styles.gridItem} ${selectedCameraId === camera.id ? styles.selected : ''} ${
                  draggingCameraId === camera.id ? styles.dragging : ''
                } ${dragOverCameraId === camera.id ? styles.dragOver : ''} ${
                  hoverResizeId === camera.id ? styles.resizeHover : ''
                }`}
                style={tileStyle}
                onClick={allowsClick ? () => handleCameraClick(camera) : undefined}
                onDoubleClick={allowsClick ? () => handleDoubleClick(camera) : undefined}
                draggable={allowsDrag}
                onDragStart={(event) => handleDragStart(camera, event)}
                onDragOver={(event) => handleDragOver(camera, event)}
                onDragLeave={() => handleDragLeave(camera)}
                onDrop={(event) => handleDrop(camera, event)}
                onDragEnd={handleDragEnd}
              >
                {camera.streamUrl ? (
                  <LiveView
                    streamUrl={camera.streamUrl}
                    embedUrl={camera.embedUrl}
                    cameraName={camera.name}
                    snapshotUrl={camera.snapshotUrl}
                    showControls={false}
                    autoPlay={true}
                    fillParent={true}
                    onHeartbeat={camera.streamType === 'direct-rtsp' ? camera.heartbeat : undefined}
                  />
                ) : (
                  <div className={styles.offline}>
                    {/* TEST-ONLY: ASCII fallback for offline indicator text. */}
                    <span className={styles.offlineIcon}>Offline</span>
                    <span className={styles.cameraName}>{camera.name}</span>
                  </div>
                )}
                {showStatus && camera.status && (
                  <span className={`${styles.statusBadge} ${styles[camera.status]} ${styles.statusOverlay}`}>
                    {camera.status}
                  </span>
                )}
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeRight}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 'e', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeBottom}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 's', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeCorner} ${styles.resizeEdgeCornerBr}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 'se', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeCorner} ${styles.resizeEdgeCornerTr}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 'ne', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeCorner} ${styles.resizeEdgeCornerBl}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 'sw', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
                <div
                  className={`${styles.resizeEdge} ${styles.resizeEdgeCorner} ${styles.resizeEdgeCornerTl}`}
                  data-resize-edge="true"
                  onPointerDown={(event) => handleResizePointerDown(camera.id, 'nw', event)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  onPointerCancel={handleResizePointerCancel}
                  onClick={handleResizeClick}
                  onPointerEnter={() => setHoverResizeId(camera.id)}
                  onPointerLeave={() => setHoverResizeId((prev) => (prev === camera.id ? null : prev))}
                  title="Drag to resize"
                  aria-label="Drag to resize"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CameraGrid;





