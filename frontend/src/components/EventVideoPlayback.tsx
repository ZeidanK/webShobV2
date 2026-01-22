import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
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
  // TEST-ONLY: Track playback timeline state for synchronized controls.
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'drift'>('synced');
  const [masterCameraId, setMasterCameraId] = useState<string | null>(null);
  const [eventOffsetSeconds, setEventOffsetSeconds] = useState(0);
  const [eventMarkerPercent, setEventMarkerPercent] = useState(0);
  // TEST-ONLY: Store per-camera video elements for synced controls.
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  // TEST-ONLY: Track clip durations to size the shared timeline.
  const durationsRef = useRef<Record<string, number>>({});
  // TEST-ONLY: Auto-seek once to the event offset after metadata loads.
  const autoSeekRef = useRef(false);

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

  // TEST-ONLY: Track playback availability for each camera in the event.
  const camerasWithPlayback = cameras.filter((camera) => camera.available);
  const unavailableCameras = cameras.filter((camera) => !camera.available);
  const layoutCount = camerasWithPlayback.length > 0 ? camerasWithPlayback.length : cameras.length;
  const columns = layout === '1x1' ? 1 : layout === '2x2' ? 2 : layout === '3x3' ? 3 : layoutCount <= 4 ? 2 : layoutCount <= 9 ? 3 : 4;
  // TEST-ONLY: Normalize event playback data for video tiles.
  const playbackCameras = useMemo(() => camerasWithPlayback.map((camera) => ({
    id: camera.cameraId ?? camera.id,
    name: camera.cameraName ?? camera.name,
    playbackUrl: camera.playbackUrl ?? camera.streamUrl,
    status: camera.status,
    clipStart: camera.playbackClipStart,
    clipEnd: camera.playbackClipEnd,
    eventOffsetSeconds: camera.playbackOffsetSeconds,
  })), [camerasWithPlayback]);

  useEffect(() => {
    if (playbackCameras.length === 0) {
      setMasterCameraId(null);
      return;
    }
    if (!masterCameraId || !playbackCameras.some((camera) => camera.id === masterCameraId)) {
      setMasterCameraId(playbackCameras[0].id);
    }
  }, [masterCameraId, playbackCameras]);

  useEffect(() => {
    // TEST-ONLY: Reset playback state when event cameras reload.
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setIsPlaying(false);
    setSyncStatus('synced');
    setEventOffsetSeconds(0);
    setEventMarkerPercent(0);
    autoSeekRef.current = false;
    durationsRef.current = {};
  }, [eventId, cameras.length]);

  useEffect(() => {
    if (!masterCameraId) {
      setEventOffsetSeconds(0);
      return;
    }
    // TEST-ONLY: Use master clip offset to anchor the event marker and seek target.
    const master = playbackCameras.find((camera) => camera.id === masterCameraId);
    const offset = master?.eventOffsetSeconds ?? 0;
    setEventOffsetSeconds(offset);
  }, [masterCameraId, playbackCameras]);

  useEffect(() => {
    if (playbackDuration <= 0) {
      setEventMarkerPercent(0);
      return;
    }
    const percent = Math.max(0, Math.min(100, (eventOffsetSeconds / playbackDuration) * 100));
    setEventMarkerPercent(percent);
  }, [eventOffsetSeconds, playbackDuration]);

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      return '00:00';
    }
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const updateSyncStatus = (masterTime: number) => {
    const driftThreshold = 0.5;
    const drifted = playbackCameras.some((camera) => {
      const video = videoRefs.current[camera.id];
      if (!video || Number.isNaN(video.currentTime)) {
        return false;
      }
      return Math.abs(video.currentTime - masterTime) > driftThreshold;
    });
    setSyncStatus(drifted ? 'drift' : 'synced');
  };

  const setAllCurrentTime = (nextTime: number) => {
    playbackCameras.forEach((camera) => {
      const video = videoRefs.current[camera.id];
      if (video && Number.isFinite(nextTime)) {
        video.currentTime = nextTime;
      }
    });
  };

  const handlePlayAll = () => {
    playbackCameras.forEach((camera) => {
      const video = videoRefs.current[camera.id];
      if (video) {
        video.play().catch(() => {
          // TEST-ONLY: Playback may require user gesture; ignore per-camera failures.
        });
      }
    });
    setIsPlaying(true);
  };

  const handlePauseAll = () => {
    playbackCameras.forEach((camera) => {
      const video = videoRefs.current[camera.id];
      video?.pause();
    });
    const anyPlaying = playbackCameras.some((camera) => {
      const video = videoRefs.current[camera.id];
      return video ? !video.paused : false;
    });
    setIsPlaying(anyPlaying);
  };

  const handleSeek = (nextTime: number) => {
    setPlaybackPosition(nextTime);
    setAllCurrentTime(nextTime);
    updateSyncStatus(nextTime);
  };

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
              {camerasWithPlayback.length === 0 && (
                <div className={styles.warning}>
                  No recordings found for this event time. Enable recording or check VMS retention settings.
                </div>
              )}
              {unavailableCameras.length > 0 && (
                <div className={styles.unavailable}>
                  <div className={styles.unavailableTitle}>Recording not available for:</div>
                  <ul className={styles.unavailableList}>
                    {unavailableCameras.map((camera) => (
                      <li key={camera.cameraId ?? camera.id} className={styles.unavailableItem}>
                        {camera.cameraName ?? camera.name}
                        {camera.playbackReason ? ` (${camera.playbackReason})` : ''}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.unavailableHint}>
                    Enable recording in Shinobi or confirm the camera has stored clips for the event time.
                  </div>
                </div>
              )}
              {/* TEST-ONLY: Playback toolbar with layout + availability summary. */}
              <div className={styles.toolbar}>
                <div className={styles.toolbarInfo}>
                  <span className={styles.infoLabel}>Cameras:</span>
                  <span className={styles.infoValue}>{cameras.length}</span>
                  <span className={styles.infoDivider}>/</span>
                  <span className={styles.infoLabel}>With recording:</span>
                  <span className={styles.infoValue}>{camerasWithPlayback.length}</span>
                  <span className={styles.infoDivider}>/</span>
                  <span className={styles.infoLabel}>Sync:</span>
                  <span className={styles.infoValue}>
                    {syncStatus === 'synced' ? 'Synced' : 'Drift'}
                  </span>
                </div>
                <div className={styles.timelineControls}>
                  <button
                    type="button"
                    className={styles.timelineButton}
                    onClick={isPlaying ? handlePauseAll : handlePlayAll}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className={styles.timelineButton}
                    onClick={() => handleSeek(eventOffsetSeconds)}
                  >
                    Jump to Event
                  </button>
                  <div className={styles.timeDisplay}>
                    {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
                  </div>
                  <div
                    className={styles.timelineTrack}
                    style={{ '--event-marker-left': `${eventMarkerPercent}%` } as CSSProperties}
                  >
                    <span className={styles.eventMarker} title="Event time" />
                    <span className={styles.eventMarkerLabel}>Event</span>
                    <input
                      className={styles.timeline}
                      type="range"
                      min={0}
                      max={playbackDuration || 0}
                      step={0.1}
                      value={playbackPosition}
                      onChange={(event) => handleSeek(parseFloat(event.target.value))}
                      disabled={playbackDuration === 0}
                    />
                  </div>
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
                <div className={styles.playbackGrid} style={{ '--grid-columns': columns } as CSSProperties}>
                  {playbackCameras.map((camera) => (
                    <div key={camera.id} className={styles.playbackTile}>
                      <div className={styles.playbackHeader}>
                        <span className={styles.playbackName}>{camera.name}</span>
                        <span className={styles.playbackStatus}>{camera.status ?? 'unknown'}</span>
                      </div>
                      <video
                        ref={(node) => {
                          videoRefs.current[camera.id] = node;
                        }}
                        className={styles.playbackVideo}
                        src={camera.playbackUrl}
                        muted
                        playsInline
                        preload="metadata"
                      onLoadedMetadata={(event) => {
                        const target = event.currentTarget;
                        if (Number.isFinite(target.duration)) {
                          durationsRef.current[camera.id] = target.duration;
                          const maxDuration = Math.max(...Object.values(durationsRef.current));
                          setPlaybackDuration(maxDuration);
                        }
                        if (camera.id === masterCameraId && !autoSeekRef.current) {
                          autoSeekRef.current = true;
                          const targetOffset = camera.eventOffsetSeconds ?? 0;
                          const maxOffset = Number.isFinite(target.duration) ? target.duration : targetOffset;
                          const clampedOffset = Math.min(Math.max(0, targetOffset), maxOffset);
                          setPlaybackPosition(clampedOffset);
                          setAllCurrentTime(clampedOffset);
                          updateSyncStatus(clampedOffset);
                        }
                      }}
                      onTimeUpdate={(event) => {
                        if (camera.id !== masterCameraId) {
                          return;
                          }
                          const current = event.currentTarget.currentTime;
                          setPlaybackPosition(current);
                          updateSyncStatus(current);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.footer}>
                <div className={styles.footerInfo}>
                  <span className={styles.footerLabel}>Cameras found:</span>
                  <span className={styles.footerValue}>{cameras.length}</span>
                  <span className={styles.footerDivider}>/</span>
                  <span className={styles.footerLabel}>With recording:</span>
                  <span className={styles.footerValue}>{camerasWithPlayback.length}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

