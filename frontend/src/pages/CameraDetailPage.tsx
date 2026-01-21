import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  Camera,
  CameraAuditLog,
  CameraCapabilities,
  CameraMaintenanceSchedule,
  CameraStatus,
  StreamUrls,
} from '../services/api';
import { LiveView } from '../components/LiveView';
import { useCameraStatus } from '../hooks/useWebSocket';
import styles from './CameraDetailPage.module.css';

type CameraFormState = {
  tags: string;
  capabilities: CameraCapabilities;
  maintenanceSchedule: CameraMaintenanceSchedule;
};

export default function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [streams, setStreams] = useState<StreamUrls | null>(null);
  const [logs, setLogs] = useState<CameraAuditLog[]>([]);
  const [formState, setFormState] = useState<CameraFormState>({
    tags: '',
    capabilities: {},
    maintenanceSchedule: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TEST-ONLY: Normalize comma-delimited tags for updates.
  const normalizeTags = useCallback((value: string): string[] => {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }, []);

  const formatTimestamp = useCallback((value?: string) => {
    if (!value) {
      return 'Never';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleString();
  }, []);

  const loadCamera = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await api.cameras.get(id, true);
      setCamera(response);
      setStreams(response.streams || null);
      setFormState({
        tags: response.tags?.join(', ') || '',
        capabilities: response.capabilities || {},
        maintenanceSchedule: response.maintenanceSchedule || {},
      });
      const auditLogs = await api.cameras.getLogs(id, 50);
      setLogs(auditLogs || []);
    } catch (err) {
      console.error('Failed to load camera details:', err);
      setError('Failed to load camera details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCamera();
  }, [loadCamera]);

  // TEST-ONLY: Apply real-time status updates to the detail view.
  useCameraStatus((payload: { cameraId: string; status: CameraStatus; checkedAt?: string }) => {
    if (!payload?.cameraId || payload.cameraId !== camera?._id) {
      return;
    }
    setCamera((prev) =>
      prev ? { ...prev, status: payload.status, lastSeen: payload.checkedAt || prev.lastSeen } : prev
    );
  });

  const handleSave = useCallback(async () => {
    if (!camera) {
      return;
    }
    try {
      setSaving(true);
      const payload = {
        tags: normalizeTags(formState.tags),
        capabilities: formState.capabilities,
        maintenanceSchedule: {
          intervalDays: formState.maintenanceSchedule.intervalDays || undefined,
          lastServiceAt: formState.maintenanceSchedule.lastServiceAt || undefined,
          nextServiceAt: formState.maintenanceSchedule.nextServiceAt || undefined,
          notes: formState.maintenanceSchedule.notes || undefined,
        },
      };
      const updated = await api.cameras.update(camera._id, payload);
      setCamera(updated);
    } catch (err) {
      console.error('Failed to update camera:', err);
      alert('Failed to update camera.');
    } finally {
      setSaving(false);
    }
  }, [camera, formState, normalizeTags]);

  const streamUrl =
    streams?.hls || streams?.raw || streams?.embed || streams?.snapshot || camera?.streamUrl || '';

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading camera...</div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>Camera not found</h2>
          <Link to="/cameras" className={styles.backLink}>Back to Cameras</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link to="/cameras" className={styles.backLink}>Back to Cameras</Link>
          <h1 className={styles.title}>{camera.name}</h1>
          <p className={styles.subtitle}>
            Status: <span className={`${styles.statusBadge} ${styles[camera.status]}`}>{camera.status}</span>
          </p>
        </div>
        <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error}
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Live Preview</h2>
          <div className={styles.preview}>
            {streamUrl ? (
              <LiveView
                streamUrl={streamUrl}
                embedUrl={streams?.embed}
                cameraName={camera.name}
                snapshotUrl={streams?.snapshot || camera.streamUrl}
              />
            ) : (
              <div className={styles.placeholder}>No stream available</div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Details</h2>
          <div className={styles.detailRow}>
            <span>Type</span>
            <span>{camera.type}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Location</span>
            <span>{camera.location?.address || 'No location set'}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Last seen</span>
            <span>{formatTimestamp(camera.lastSeen)}</span>
          </div>
          <div className={styles.detailRow}>
            <span>VMS</span>
            <span>{camera.vms?.serverId ? 'Connected' : 'Manual'}</span>
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Tags</h2>
          <input
            className={styles.input}
            value={formState.tags}
            onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="comma-separated tags"
          />
          <div className={styles.tagList}>
            {camera.tags?.map((tag) => (
              <span key={tag} className={styles.tagPill}>{tag}</span>
            ))}
            {!camera.tags?.length && <span className={styles.placeholderText}>No tags</span>}
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Capabilities</h2>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!formState.capabilities.ptz}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, ptz: event.target.checked },
                }))
              }
            />
            PTZ
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!formState.capabilities.audio}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, audio: event.target.checked },
                }))
              }
            />
            Audio
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!formState.capabilities.motionDetection}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, motionDetection: event.target.checked },
                }))
              }
            />
            Motion Detection
          </label>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Maintenance</h2>
          <label className={styles.inputLabel}>Interval (days)</label>
          <input
            className={styles.input}
            type="number"
            min="1"
            value={formState.maintenanceSchedule.intervalDays || ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                maintenanceSchedule: {
                  ...prev.maintenanceSchedule,
                  intervalDays: event.target.value ? Number(event.target.value) : undefined,
                },
              }))
            }
          />
          <label className={styles.inputLabel}>Last service</label>
          <input
            className={styles.input}
            type="datetime-local"
            value={formState.maintenanceSchedule.lastServiceAt || ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                maintenanceSchedule: {
                  ...prev.maintenanceSchedule,
                  lastServiceAt: event.target.value || undefined,
                },
              }))
            }
          />
          <label className={styles.inputLabel}>Next service</label>
          <input
            className={styles.input}
            type="datetime-local"
            value={formState.maintenanceSchedule.nextServiceAt || ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                maintenanceSchedule: {
                  ...prev.maintenanceSchedule,
                  nextServiceAt: event.target.value || undefined,
                },
              }))
            }
          />
          <label className={styles.inputLabel}>Notes</label>
          <textarea
            className={styles.textarea}
            value={formState.maintenanceSchedule.notes || ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                maintenanceSchedule: {
                  ...prev.maintenanceSchedule,
                  notes: event.target.value,
                },
              }))
            }
          />
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Activity</h2>
          {logs.length === 0 && (
            <div className={styles.placeholderText}>No audit logs available.</div>
          )}
          {logs.length > 0 && (
            <div className={styles.logList}>
              {logs.map((log) => (
                <div key={log._id} className={styles.logItem}>
                  <div className={styles.logHeader}>
                    <span>{log.action}</span>
                    <span>{formatTimestamp(log.timestamp)}</span>
                  </div>
                  {(() => {
                    // TEST-ONLY: Guard metadata message type for render safety.
                    const message =
                      typeof log.metadata?.message === 'string' ? log.metadata.message : '';
                    return message ? (
                      <div className={styles.logMessage}>{message}</div>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
