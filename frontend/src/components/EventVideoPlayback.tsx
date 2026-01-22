import { useState, useEffect, useMemo } from 'react';
import { CameraGrid } from './CameraGrid';
import { apiClient } from '../services/api';
import styles from './EventVideoPlayback.module.css';

interface EventVideoPlaybackProps {
  eventId: string;
  onClose: () => void;
}

export function EventVideoPlayback({ eventId, onClose }: EventVideoPlaybackProps) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TEST-ONLY: Layout selection for playback grid sizing.
  const [layout, setLayout] = useState<'auto' | '1x1' | '2x2' | '3x3'>('auto');

  useEffect(() => {
    const fetchPlayback = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch event playback data via the shared API client.
        const response = await apiClient.get<{ event: any; cameras: any[] }>(`/events/${eventId}/video-playback`);
        setEvent(response.event);
        setCameras(response.cameras || []);
      } catch (err: any) {
        console.error('Failed to load cameras:', err);
        setError(err.message || 'Failed to load cameras');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayback();
  }, [eventId]);

  const camerasWithRecording = cameras.filter((c) => c.hasRecording);
  const columns = layout === '1x1' ? 1 : layout === '2x2' ? 2 : layout === '3x3' ? 3 : cameras.length <= 4 ? 2 : cameras.length <= 9 ? 3 : 4;
  // TEST-ONLY: Normalize event playback data to CameraGrid fields.
  const gridCameras = useMemo(() => cameras.map((camera) => ({
    id: camera.cameraId ?? camera.id,
    name: camera.name,
    streamUrl: camera.streamUrl,
    status: camera.status,
  })), [cameras]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2>Event Cameras</h2>
            {event && <p className={styles.eventTitle}>{event.title}</p>}
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close">Close</button>
        </div>

        <div className={styles.content}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading cameras...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <div className={styles.errorIcon}>Error</div>
              <div className={styles.errorText}>{error}</div>
            </div>
          )}

          {!loading && !error && cameras.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>No cameras</div>
              <div className={styles.emptyTitle}>No cameras found</div>
              <div className={styles.emptyText}>
                No cameras are located near this event.
              </div>
            </div>
          )}

          {!loading && !error && cameras.length > 0 && (
            <>
              {camerasWithRecording.length === 0 && (
                <div className={styles.warning}>Warning: no cameras have recording enabled. Only live feeds available.</div>
              )}
              {/* TEST-ONLY: Playback toolbar with layout + availability summary. */}
              <div className={styles.toolbar}>
                <div className={styles.toolbarInfo}>
                  <span className={styles.infoLabel}>Cameras:</span>
                  <span className={styles.infoValue}>{cameras.length}</span>
                  <span className={styles.infoDivider}>/</span>
                  <span className={styles.infoLabel}>With recording:</span>
                  <span className={styles.infoValue}>{camerasWithRecording.length}</span>
                </div>
                <label className={styles.layoutLabel}>
                  Layout
                  <select
                    className={styles.layoutSelect}
                    value={layout}
                    onChange={(event) => setLayout(event.target.value as typeof layout)}
                  >
                    <option value="auto">Auto</option>
                    <option value="1x1">1x1</option>
                    <option value="2x2">2x2</option>
                    <option value="3x3">3x3</option>
                  </select>
                </label>
              </div>
              <div className={styles.gridContainer}>
                <CameraGrid cameras={gridCameras} columns={columns} />
              </div>
              <div className={styles.footer}>
                <div className={styles.footerInfo}>
                  <span className={styles.footerLabel}>Cameras found:</span>
                  <span className={styles.footerValue}>{cameras.length}</span>
                  <span className={styles.footerDivider}>/</span>
                  <span className={styles.footerLabel}>With recording:</span>
                  <span className={styles.footerValue}>{camerasWithRecording.length}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

