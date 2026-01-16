import React, { useState, useEffect } from 'react';
import { CameraGrid } from './CameraGrid';
import { api } from '../services/api';
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

  useEffect(() => {
    const fetchPlayback = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/events/${eventId}/video-playback`);
        setEvent(response.data.event);
        setCameras(response.data.cameras || []);
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
  const columns = cameras.length <= 4 ? 2 : cameras.length <= 9 ? 3 : 4;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2>Event Cameras</h2>
            {event && <p className={styles.eventTitle}>{event.title}</p>}
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close">
            ✕
          </button>
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
              <div className={styles.errorIcon}>⚠️</div>
              <div className={styles.errorText}>{error}</div>
            </div>
          )}

          {!loading && !error && cameras.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📹</div>
              <div className={styles.emptyTitle}>No cameras found</div>
              <div className={styles.emptyText}>
                No cameras are located near this event.
              </div>
            </div>
          )}

          {!loading && !error && cameras.length > 0 && (
            <>
              {camerasWithRecording.length === 0 && (
                <div className={styles.warning}>
                  ⚠️ No cameras have recording enabled. Only live feeds available.
                </div>
              )}
              <div className={styles.gridContainer}>
                <CameraGrid cameras={cameras} columns={columns} />
              </div>
              <div className={styles.footer}>
                <div className={styles.footerInfo}>
                  <span className={styles.footerLabel}>Cameras found:</span>
                  <span className={styles.footerValue}>{cameras.length}</span>
                  <span className={styles.footerDivider}>•</span>
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
