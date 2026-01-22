import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, Camera } from '../services/api';
import { LiveView } from '../components/LiveView';
import styles from './CameraDetailPage.module.css';

export default function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);

  const loadCamera = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.cameras.get(id);
      setCamera(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load camera');
      console.error('[CameraDetailPage] Error loading camera:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStream = async () => {
    if (!id) return;
    
    try {
      setLoadingStream(true);
      const streams = await api.cameras.getStreams(id);
      if (streams.hls) {
        setStreamUrl(streams.hls);
      } else if (streams.raw) {
        setStreamUrl(streams.raw);
      } else if (camera?.streamUrl) {
        setStreamUrl(camera.streamUrl);
      }
    } catch (err: any) {
      console.error('[CameraDetailPage] Error loading stream:', err);
    } finally {
      setLoadingStream(false);
    }
  };

  useEffect(() => {
    loadCamera();
    loadStream();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading camera details...</div>
      </div>
    );
  }

  if (error || !camera) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error || 'Camera not found'}</p>
          <button onClick={() => navigate('/cameras')} className={styles.backButton}>
            Back to Cameras
          </button>
        </div>
      </div>
    );
  }

  const getStatusClass = (status: string) => {
    return `${styles.statusBadge} ${styles[`status${status.charAt(0).toUpperCase() + status.slice(1)}`]}`;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            ← Back
          </button>
          <div className={styles.headerActions}>
            <Link to="/cameras" className={styles.linkButton}>
              All Cameras
            </Link>
            <button
              onClick={() => {
                sessionStorage.setItem('monitorWallContext', JSON.stringify({
                  source: 'camera-detail',
                  cameraIds: [camera._id],
                  cameraName: camera.name,
                  timestamp: new Date().toISOString(),
                }));
                navigate('/cameras/monitor-wall');
              }}
              className={styles.primaryButton}
            >
              Open in Monitor Wall
            </button>
          </div>
        </div>
        
        <div className={styles.headerContent}>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>📹 {camera.name}</h1>
            <span className={getStatusClass(camera.status)}>
              {camera.status}
            </span>
          </div>
          {camera.description && (
            <p className={styles.description}>{camera.description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Live Stream Preview */}
        <div className={styles.streamSection}>
          <h2 className={styles.sectionTitle}>Live Stream</h2>
          {loadingStream ? (
            <div className={styles.streamLoading}>Loading stream...</div>
          ) : streamUrl ? (
            <div className={styles.streamContainer}>
              <LiveView
                url={streamUrl}
                cameraId={camera._id}
                cameraName={camera.name}
              />
            </div>
          ) : (
            <div className={styles.noStream}>
              <p>No stream available for this camera</p>
              {camera.streamUrl && (
                <p className={styles.streamUrl}>
                  Stream URL: <code>{camera.streamUrl}</code>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Camera Details */}
        <div className={styles.detailsGrid}>
          {/* Basic Information */}
          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Basic Information</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Camera ID:</span>
              <span className={styles.detailValue}>{camera._id}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type:</span>
              <span className={styles.detailValue}>{camera.type.toUpperCase()}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status:</span>
              <span className={styles.detailValue}>
                <span className={getStatusClass(camera.status)}>
                  {camera.status}
                </span>
              </span>
            </div>
            {camera.lastSeen && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Last Seen:</span>
                <span className={styles.detailValue}>
                  {new Date(camera.lastSeen).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Location Information */}
          {camera.location && (
            <div className={styles.detailCard}>
              <h3 className={styles.cardTitle}>Location</h3>
              {camera.location.address && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Address:</span>
                  <span className={styles.detailValue}>{camera.location.address}</span>
                </div>
              )}
              {camera.location.coordinates && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Coordinates:</span>
                  <span className={styles.detailValue}>
                    {camera.location.coordinates[1].toFixed(6)}, {camera.location.coordinates[0].toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* VMS Information */}
          {camera.vms && (
            <div className={styles.detailCard}>
              <h3 className={styles.cardTitle}>VMS Integration</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Provider:</span>
                <span className={styles.detailValue}>{camera.vms.provider}</span>
              </div>
              {camera.vms.monitorId && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Monitor ID:</span>
                  <span className={styles.detailValue}>{camera.vms.monitorId}</span>
                </div>
              )}
              {camera.vms.groupKey && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Group:</span>
                  <span className={styles.detailValue}>{camera.vms.groupKey}</span>
                </div>
              )}
            </div>
          )}

          {/* Stream Information */}
          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Stream Configuration</h3>
            {camera.streamUrl && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Stream URL:</span>
                <span className={styles.detailValue}>
                  <code className={styles.codeBlock}>{camera.streamUrl}</code>
                </span>
              </div>
            )}
            {streamUrl && streamUrl !== camera.streamUrl && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Active Stream:</span>
                <span className={styles.detailValue}>
                  <code className={styles.codeBlock}>{streamUrl}</code>
                </span>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Timestamps</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Created:</span>
              <span className={styles.detailValue}>
                {new Date(camera.createdAt).toLocaleString()}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Last Updated:</span>
              <span className={styles.detailValue}>
                {new Date(camera.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
