import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera, VmsServer, CameraStatus } from '../services/api';
import { LiveView } from '../components/LiveView';
import { getCurrentUser } from '../utils/auth';
import styles from './CamerasPage.module.css';

type ViewMode = 'grid' | 'list';

interface CameraFormData {
  name: string;
  description: string;
  type: 'ip' | 'analog' | 'usb';
  status: CameraStatus;
  streamUrl: string;
  latitude: string;
  longitude: string;
  address: string;
  companyId?: string;
}

interface Company {
  _id: string;
  name: string;
  type: string;
  status: string;
}

const defaultFormData: CameraFormData = {
  name: '',
  description: '',
  type: 'ip',
  status: 'online',
  streamUrl: '',
  latitude: '',
  longitude: '',
  address: '',
};

export default function CamerasPage() {
  const currentUser = getCurrentUser();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [vmsServers, setVmsServers] = useState<VmsServer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CameraStatus | ''>('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState<CameraFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  
  // Live view state
  const [liveViewCamera, setLiveViewCamera] = useState<Camera | null>(null);
  const [streamOverrides, setStreamOverrides] = useState<Record<string, string>>({});

  // Fetch cameras and VMS servers
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [camerasData, vmsData] = await Promise.all([
        api.cameras.list({ search, status: statusFilter || undefined }),
        api.vms.list(),
      ]);
      
      setCameras(camerasData || []);
      setVmsServers(vmsData || []);
      
      // Fetch companies if super_admin
      if (currentUser?.role === 'super_admin') {
        const companiesResponse = await api.companies.list();
        setCompanies(companiesResponse.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load cameras. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, currentUser?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open add/edit modal
  const openModal = (camera?: Camera) => {
    if (camera) {
      setEditingCamera(camera);
      setFormData({
        name: camera.name,
        description: camera.description || '',
        type: camera.type,
        status: camera.status,
        streamUrl: camera.streamUrl || '',
        latitude: camera.location?.coordinates?.[1]?.toString() || '',
        longitude: camera.location?.coordinates?.[0]?.toString() || '',
        address: camera.location?.address || '',
      });
    } else {
      setEditingCamera(null);
      setFormData(defaultFormData);
    }
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const cameraData = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        status: formData.status,
        streamUrl: formData.streamUrl || undefined,
        location: {
          coordinates: [
            parseFloat(formData.longitude) || 0,
            parseFloat(formData.latitude) || 0,
          ] as [number, number],
          address: formData.address || undefined,
        },
        ...(formData.companyId && { companyId: formData.companyId }),
      };

      if (editingCamera) {
        await api.cameras.update(editingCamera._id, cameraData);
      } else {
        await api.cameras.create(cameraData);
      }

      setShowModal(false);
      // Clear filters to ensure newly created camera appears in list
      setStatusFilter('');
      setSearch('');
      fetchData();
    } catch (err) {
      console.error('Failed to save camera:', err);
      alert('Failed to save camera. Please check your input and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Delete camera
  const handleDelete = async (camera: Camera) => {
    if (!confirm(`Are you sure you want to delete "${camera.name}"?`)) {
      return;
    }

    try {
      await api.cameras.delete(camera._id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete camera:', err);
      alert('Failed to delete camera.');
    }
  };

  // Open live view
  const openLiveView = async (camera: Camera) => {
    setLiveViewCamera(camera);
    if (camera.streamUrl || streamOverrides[camera._id]) {
      return;
    }

    try {
      const streams = await api.cameras.getStreams(camera._id);
      const streamUrl = streams.hls || streams.raw || streams.embed || streams.snapshot;
      if (streamUrl) {
        setStreamOverrides((prev) => ({ ...prev, [camera._id]: streamUrl }));
      }
    } catch (err) {
      console.error('Failed to load camera streams:', err);
    }
  };

  // Get stream URL for camera
  const getStreamUrl = (camera: Camera): string | null => {
    if (streamOverrides[camera._id]) {
      return streamOverrides[camera._id];
    }

    if (camera.streamUrl) {
      return camera.streamUrl;
    }

    return null;
  };

  // Filter cameras
  const filteredCameras = cameras.filter(camera => {
    if (statusFilter && camera.status !== statusFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        camera.name.toLowerCase().includes(searchLower) ||
        camera.description?.toLowerCase().includes(searchLower) ||
        camera.location?.address?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📹 Cameras</h1>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ▦ Grid
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰ List
            </button>
          </div>
          <Link to="/vms-settings" className={styles.settingsButton}>
            ⚙️ VMS Settings
          </Link>
          <button className={styles.addButton} onClick={() => openModal()}>
            + Add Camera
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search cameras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CameraStatus | '')}
          className={styles.filterSelect}
        >
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="error">Error</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.emptyState}>
          <span>⚠️</span>
          <h3>Error Loading Cameras</h3>
          <p>{error}</p>
          <button className={styles.addButton} onClick={fetchData}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!error && filteredCameras.length === 0 && (
        <div className={styles.emptyState}>
          <span>📹</span>
          <h3>No Cameras Found</h3>
          <p>
            {cameras.length === 0
              ? 'Add your first camera to start monitoring.'
              : 'No cameras match your search criteria.'}
          </p>
          {cameras.length === 0 && (
            <button className={styles.addButton} onClick={() => openModal()}>
              + Add Camera
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!error && filteredCameras.length > 0 && viewMode === 'grid' && (
        <div className={styles.cameraGrid}>
          {filteredCameras.map((camera) => (
            <div key={camera._id} className={styles.cameraCard}>
              <div
                className={styles.cameraPreview}
                onClick={() => openLiveView(camera)}
              >
                {camera.status === 'online' ? (
                  <>
                    <div className={styles.liveIndicator}>LIVE</div>
                    <div className={styles.placeholder}>
                      <span>▶</span>
                      Click to view
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholder}>
                    <span>📷</span>
                    {camera.status === 'offline' ? 'Camera Offline' : camera.status}
                  </div>
                )}
                <span className={`${styles.statusBadge} ${styles[camera.status]}`}>
                  {camera.status}
                </span>
              </div>
              <div className={styles.cameraInfo}>
                <h3 className={styles.cameraName}>{camera.name}</h3>
                <p className={styles.cameraLocation}>
                  📍 {camera.location?.address || 'No location set'}
                </p>
                <div className={styles.cameraActions}>
                  <button
                    className={`${styles.actionButton} ${styles.primary}`}
                    onClick={() => openLiveView(camera)}
                    disabled={camera.status !== 'online'}
                  >
                    ▶ View
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => openModal(camera)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDelete(camera)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!error && filteredCameras.length > 0 && viewMode === 'list' && (
        <div className={styles.cameraList}>
          <div className={styles.listHeader}>
            <span>Camera</span>
            <span>Type</span>
            <span>Status</span>
            <span>VMS</span>
            <span>Actions</span>
          </div>
          {filteredCameras.map((camera) => (
            <div key={camera._id} className={styles.listRow}>
              <div>
                <strong>{camera.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {camera.location?.address || 'No location'}
                </div>
              </div>
              <span style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                {camera.type}
              </span>
              <span className={`${styles.statusBadge} ${styles[camera.status]}`}>
                {camera.status}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {camera.vms?.serverId ? 'Connected' : 'Manual'}
              </span>
              <div className={styles.cameraActions}>
                <button
                  className={`${styles.actionButton} ${styles.primary}`}
                  onClick={() => openLiveView(camera)}
                  disabled={camera.status !== 'online'}
                >
                  ▶
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => openModal(camera)}
                >
                  ✏️
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => handleDelete(camera)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingCamera ? 'Edit Camera' : 'Add Camera'}
              </h2>
              <button
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                {/* Company Selector - Super Admins Only */}
                {currentUser?.role === 'super_admin' && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Company *</label>
                    <select
                      value={formData.companyId || ''}
                      onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                      className={styles.formSelect}
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company._id} value={company._id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Camera Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={styles.formInput}
                    required
                    placeholder="e.g., Front Entrance Camera"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className={styles.formTextarea}
                    placeholder="Optional description of camera coverage area"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as CameraFormData['type'],
                        })
                      }
                      className={styles.formSelect}
                    >
                      <option value="ip">IP Camera</option>
                      <option value="analog">Analog</option>
                      <option value="usb">USB</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as CameraFormData['status'],
                        })
                      }
                      className={styles.formSelect}
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="error">Error</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Stream URL</label>
                  <input
                    type="text"
                    value={formData.streamUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, streamUrl: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="rtsp:// or http:// stream URL"
                  />
                  <p className={styles.formHint}>
                    Direct stream URL. Leave empty if using VMS integration.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Location</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="Street address or location name"
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <div className={styles.formRow}>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData({ ...formData, latitude: e.target.value })
                      }
                      className={styles.formInput}
                      placeholder="Latitude"
                    />
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData({ ...formData, longitude: e.target.value })
                      }
                      className={styles.formInput}
                      placeholder="Longitude"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={saving || !formData.name}
                >
                  {saving ? 'Saving...' : editingCamera ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live View Modal */}
      {liveViewCamera && (
        <div
          className={styles.liveViewOverlay}
          onClick={() => setLiveViewCamera(null)}
        >
          <div
            className={styles.liveViewContainer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.liveViewHeader}>
              <h2 className={styles.liveViewTitle}>
                🔴 {liveViewCamera.name}
              </h2>
              <button
                className={styles.closeButton}
                onClick={() => setLiveViewCamera(null)}
              >
                ✕ Close
              </button>
            </div>
            <LiveView
              streamUrl={getStreamUrl(liveViewCamera) || ''}
              cameraName={liveViewCamera.name}
              className={styles.liveViewVideo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
