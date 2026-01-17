/**
 * LiveView Component
 * 
 * HLS video player for live camera streams from VMS (Shinobi, etc.).
 * Uses hls.js for HLS stream playback with native fallback.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import styles from './LiveView.module.css';

interface LiveViewProps {
  /** HLS stream URL (.m3u8) */
  streamUrl: string;
  
  /** Camera name for display */
  cameraName?: string;
  
  /** Optional snapshot URL for poster image */
  snapshotUrl?: string;
  
  /** Enable/disable autoplay */
  autoPlay?: boolean;
  
  /** Mute audio by default */
  muted?: boolean;
  
  /** Show player controls */
  showControls?: boolean;
  
  /** Callback when stream loads */
  onLoad?: () => void;
  
  /** Callback when stream errors */
  onError?: (error: string) => void;
  
  /** Optional CSS class */
  className?: string;
  
  /** Fixed aspect ratio */
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

interface StreamState {
  loading: boolean;
  error: string | null;
  playing: boolean;
}

export const LiveView: React.FC<LiveViewProps> = ({
  streamUrl,
  cameraName,
  snapshotUrl,
  autoPlay = true,
  muted = true,
  showControls = true,
  onLoad,
  onError,
  className,
  aspectRatio = '16:9',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [state, setState] = useState<StreamState>({
    loading: true,
    error: null,
    playing: false,
  });

  // Cleanup HLS instance
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Initialize HLS stream
  const initializeHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    cleanupHls();
    setState({ loading: true, error: null, playing: false });

    // Check if native HLS is supported (Safari, iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setState(prev => ({ ...prev, loading: false }));
        onLoad?.();
        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay may be blocked, user can click to play
          });
        }
      });
      video.addEventListener('error', () => {
        const errorMsg = 'Stream playback failed';
        setState({ loading: false, error: errorMsg, playing: false });
        onError?.(errorMsg);
      });
      return;
    }

    // Use hls.js for other browsers
    if (!Hls.isSupported()) {
      const errorMsg = 'HLS is not supported in this browser';
      setState({ loading: false, error: errorMsg, playing: false });
      onError?.(errorMsg);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      // Reconnection settings
      manifestLoadingMaxRetry: 3,
      levelLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 3,
    });

    hlsRef.current = hls;

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(streamUrl);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setState(prev => ({ ...prev, loading: false }));
      onLoad?.();
      if (autoPlay) {
        video.play().catch(() => {
          // Autoplay may be blocked
        });
      }
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Try to recover from network errors
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            // Try to recover from media errors
            hls.recoverMediaError();
            break;
          default:
            const errorMsg = `Stream error: ${data.details}`;
            setState({ loading: false, error: errorMsg, playing: false });
            onError?.(errorMsg);
            cleanupHls();
            break;
        }
      }
    });

    hls.attachMedia(video);
  }, [streamUrl, autoPlay, cleanupHls, onLoad, onError]);

  // Initialize on mount and URL change
  useEffect(() => {
    initializeHls();
    return cleanupHls;
  }, [initializeHls, cleanupHls]);

  // Handle play state
  const handlePlay = () => {
    setState(prev => ({ ...prev, playing: true }));
  };

  const handlePause = () => {
    setState(prev => ({ ...prev, playing: false }));
  };

  // Manual retry
  const handleRetry = () => {
    initializeHls();
  };

  // Get aspect ratio CSS class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '4:3':
        return styles.aspect4x3;
      case '1:1':
        return styles.aspect1x1;
      default:
        return styles.aspect16x9;
    }
  };

  return (
    <div className={`${styles.container} ${getAspectRatioClass()} ${className || ''}`}>
      {/* Camera name header */}
      {cameraName && (
        <div className={styles.header}>
          <span className={styles.cameraName}>{cameraName}</span>
          <span className={`${styles.status} ${state.playing ? styles.live : ''}`}>
            {state.playing ? '● LIVE' : state.loading ? 'Loading...' : 'Offline'}
          </span>
        </div>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        className={styles.video}
        controls={showControls}
        muted={muted}
        playsInline
        poster={snapshotUrl}
        onPlay={handlePlay}
        onPause={handlePause}
      />

      {/* Loading overlay */}
      {state.loading && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <span>Connecting to stream...</span>
        </div>
      )}

      {/* Error overlay */}
      {state.error && (
        <div className={styles.overlay}>
          <div className={styles.errorIcon}>⚠️</div>
          <span className={styles.errorText}>{state.error}</span>
          <button className={styles.retryButton} onClick={handleRetry}>
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveView;
