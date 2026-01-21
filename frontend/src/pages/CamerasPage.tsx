import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, Camera, VmsServer, CameraStatus, StreamUrls } from '../services/api';
import { LiveView } from '../components/LiveView';
import { getCurrentUser } from '../utils/auth';
import { useCameraStatus } from '../hooks/useWebSocket';
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
  tags: string;
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
  tags: '',
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
  const [tagFilter, setTagFilter] = useState('');
  const [vmsFilter, setVmsFilter] = useState<'all' | 'connected' | 'manual'>('all');
  const [vmsServerFilter, setVmsServerFilter] = useState('');

  // TEST-ONLY: Bulk selection and actions.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<CameraStatus>('offline');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkMode, setBulkMode] = useState<'add' | 'remove' | 'set'>('add');
  const [bulkBusy, setBulkBusy] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [formData, setFormData] = useState<CameraFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  
  // Live view state
  const [liveViewCamera, setLiveViewCamera] = useState<Camera | null>(null);
  // TEST-ONLY: Cache stream URL variants for LiveView fallback handling.
  const [streamOverrides, setStreamOverrides] = useState<Record<string, StreamUrls>>({});

  // TEST-ONLY: Normalize comma-delimited tag inputs for filters and bulk actions.
  const normalizeTags = useCallback((value: string): string[] => {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }, []);

  const formatLastSeen = useCallback((value?: string) => {
    if (!value) {
      return 'Never';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleString();
  }, []);

  // TEST-ONLY: Build auto-complete suggestions from known camera metadata.
  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    cameras.forEach((camera) => {
      if (camera.name) {
        suggestions.add(camera.name);
      }
      if (camera.location?.address) {
        suggestions.add(camera.location.address);
      }
      camera.tags?.forEach((tag) => suggestions.add(tag));
    });
    return Array.from(suggestions).slice(0, 12);
  }, [cameras]);

  // Fetch cameras and VMS servers
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const resolvedTags = normalizeTags(tagFilter);
      const resolvedHasVms =
        vmsFilter === 'connected' ? true : vmsFilter === 'manual' ? false : undefined;
      const [camerasData, vmsData] = await Promise.all([
        api.cameras.list({
          search,
          status: statusFilter || undefined,
          hasVms: resolvedHasVms,
          vmsServerId: vmsServerFilter || undefined,
          tags: resolvedTags.length > 0 ? resolvedTags : undefined,
        }),
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
  }, [search, statusFilter, tagFilter, vmsFilter, vmsServerFilter, normalizeTags, currentUser?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // TEST-ONLY: Clear bulk selection when the camera list changes.
  useEffect(() => {
    setSelectedIds([]);
  }, [cameras]);

  // TEST-ONLY: Apply real-time status updates from WebSocket.
  useCameraStatus((payload: { cameraId: string; status: CameraStatus; checkedAt?: string }) => {
    if (!payload?.cameraId) {
      return;
    }
    setCameras((prev) =>
      prev.map((camera) =>
        camera._id === payload.cameraId
          ? { ...camera, status: payload.status, lastSeen: payload.checkedAt || camera.lastSeen }
          : camera
      )
    );
    setLiveViewCamera((prev) =>
      prev && prev._id === payload.cameraId
        ? { ...prev, status: payload.status, lastSeen: payload.checkedAt || prev.lastSeen }
        : prev
    );
  });

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
        tags: camera.tags?.join(', ') || '',
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
        // TEST-ONLY: Save tag list from comma-delimited input.
        tags: normalizeTags(formData.tags),
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
      // TEST-ONLY: Store all stream variants for fallback playback.
      setStreamOverrides((prev) => ({ ...prev, [camera._id]: streams }));
    } catch (err) {
      console.error('Failed to load camera streams:', err);
    }
  };

  // Get stream URL for camera
  const getStreamUrl = (camera: Camera): string | null => {
    const overrides = streamOverrides[camera._id];
    if (overrides) {
      return overrides.hls || overrides.raw || overrides.embed || overrides.snapshot || null;
    }

    if (camera.streamUrl) {
      return camera.streamUrl;
    }

    return null;
  };

  // TEST-ONLY: Apply client-side filtering to match visible state in the UI.
  const filteredCameras = useMemo(() => {
    const tagList = normalizeTags(tagFilter);
    return cameras.filter((camera) => {
      if (statusFilter && camera.status !== statusFilter) return false;
      if (vmsFilter === 'connected' && !camera.vms?.serverId) return false;
      if (vmsFilter === 'manual' && camera.vms?.serverId) return false;
      if (vmsServerFilter && camera.vms?.serverId !== vmsServerFilter) return false;
      if (tagList.length > 0 && !tagList.some((tag) => camera.tags?.includes(tag))) return false;
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
  }, [cameras, statusFilter, vmsFilter, vmsServerFilter, tagFilter, search, normalizeTags]);

  // TEST-ONLY: Bulk selection helpers.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const toggleSelection = useCallback((cameraId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(cameraId)) {
        return prev.filter((id) => id !== cameraId);
      }
      return [...prev, cameraId];
    });
  }, []);
  const toggleSelectAll = useCallback(() => {
    const allIds = filteredCameras.map((camera) => camera._id);
    const allSelected = allIds.every((id) => selectedSet.has(id));
    setSelectedIds(allSelected ? [] : allIds);
  }, [filteredCameras, selectedSet]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    try {
      setBulkBusy(true);
      await api.cameras.bulkUpdateStatus(selectedIds, bulkStatus);
      clearSelection();
      fetchData();
    } catch (err) {
      console.error('Failed to update camera status:', err);
      alert('Failed to update camera status.');
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, bulkStatus, clearSelection, fetchData]);

  const handleBulkTags = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const tags = normalizeTags(bulkTags);
    if (tags.length === 0) {
      alert('Enter at least one tag.');
      return;
    }
    try {
      setBulkBusy(true);
      await api.cameras.bulkTag(selectedIds, tags, bulkMode);
      clearSelection();
      fetchData();
    } catch (err) {
      console.error('Failed to update camera tags:', err);
      alert('Failed to update camera tags.');
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, bulkTags, bulkMode, normalizeTags, clearSelection, fetchData]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const ok = confirm(`Delete ${selectedIds.length} camera(s)? This cannot be undone.`);
    if (!ok) {
      return;
    }
    try {
      setBulkBusy(true);
      await api.cameras.bulkDelete(selectedIds);
      clearSelection();
      fetchData();
    } catch (err) {
      console.error('Failed to delete cameras:', err);
      alert('Failed to delete cameras.');
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, clearSelection, fetchData]);

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
        <h1 className={styles.title}>Cameras</h1>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          <Link to="/vms-settings" className={styles.settingsButton}>
            VMS Settings
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
          list="camera-search-suggestions"
          className={styles.searchInput}
        />
        <datalist id="camera-search-suggestions">
          {searchSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <input
          type="text"
          placeholder="Tags (comma separated)"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
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
        <select
          value={vmsFilter}
          onChange={(e) => setVmsFilter(e.target.value as typeof vmsFilter)}
          className={styles.filterSelect}
        >
          <option value="all">All VMS</option>
          <option value="connected">Connected</option>
          <option value="manual">Manual</option>
        </select>
        <select
          value={vmsServerFilter}
          onChange={(e) => setVmsServerFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All Servers</option>
          {vmsServers.map((server) => (
            <option key={server._id} value={server._id}>
              {server.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions */}
      <div className={styles.bulkToolbar}>
        <div className={styles.bulkSelection}>
          <button
            className={styles.bulkButton}
            onClick={toggleSelectAll}
            disabled={filteredCameras.length === 0}
          >
            {selectedIds.length === filteredCameras.length && filteredCameras.length > 0
              ? 'Clear All'
              : 'Select All'}
          </button>
          <button
            className={styles.bulkButton}
            onClick={clearSelection}
            disabled={selectedIds.length === 0}
          >
            Clear Selection
          </button>
          <span className={styles.bulkCount}>{selectedIds.length} selected</span>
        </div>
        <div className={styles.bulkActions}>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as CameraStatus)}
            className={styles.filterSelect}
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <button
            className={styles.bulkPrimary}
            onClick={handleBulkStatusUpdate}
            disabled={bulkBusy || selectedIds.length === 0}
          >
            Update Status
          </button>
          <input
            type="text"
            placeholder="Tags for bulk update"
            value={bulkTags}
            onChange={(e) => setBulkTags(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={bulkMode}
            onChange={(e) => setBulkMode(e.target.value as typeof bulkMode)}
            className={styles.filterSelect}
          >
            <option value="add">Add Tags</option>
            <option value="remove">Remove Tags</option>
            <option value="set">Set Tags</option>
          </select>
          <button
            className={styles.bulkButton}
            onClick={handleBulkTags}
            disabled={bulkBusy || selectedIds.length === 0}
          >
            Apply Tags
          </button>
          <button
            className={styles.bulkDanger}
            onClick={handleBulkDelete}
            disabled={bulkBusy || selectedIds.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.emptyState}>
          <span>!</span>
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
          <span>CAM</span>
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
                <label
                  className={styles.selectionBox}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(camera._id)}
                    onChange={() => toggleSelection(camera._id)}
                  />
                </label>
                {camera.status === 'online' ? (
                  <>
                    <div className={styles.liveIndicator}>LIVE</div>
                    <div className={styles.placeholder}>
                      <span>Preview</span>
                      Click to view
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholder}>
                    <span>Preview</span>
                    {camera.status === 'offline' ? 'Camera Offline' : camera.status}
                  </div>
                )}
                <span
                  className={`${styles.statusBadge} ${styles[camera.status]}`}
                  title={`Status: ${camera.status} | Last seen: ${formatLastSeen(camera.lastSeen)}`}
                >
                  {camera.status}
                </span>
              </div>
              <div className={styles.cameraInfo}>
                <h3 className={styles.cameraName}>{camera.name}</h3>
                <p className={styles.cameraLocation}>
                  Location: {camera.location?.address || 'No location set'}
                </p>
                {camera.tags && camera.tags.length > 0 && (
                  <div className={styles.cameraTags}>
                    {camera.tags.map((tag) => (
                      <span key={tag} className={styles.tagPill}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.cameraMeta}>
                  <span>Last seen: {formatLastSeen(camera.lastSeen)}</span>
                </div>
                <div className={styles.cameraActions}>
                  <button
                    className={`${styles.actionButton} ${styles.primary}`}
                    onClick={() => openLiveView(camera)}
                    disabled={camera.status !== 'online'}
                  >
                    View
                  </button>
                  <Link className={styles.actionButton} to={`/cameras/${camera._id}`}>
                    Details
                  </Link>
                  <button
                    className={styles.actionButton}
                    onClick={() => openModal(camera)}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDelete(camera)}
                  >
                    Delete
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
            <span>Select</span>
            <span>Camera</span>
            <span>Type</span>
            <span>Status</span>
            <span>VMS</span>
            <span>Last Seen</span>
            <span>Actions</span>
          </div>
          {filteredCameras.map((camera) => (
            <div key={camera._id} className={styles.listRow}>
              <label className={styles.listCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(camera._id)}
                  onChange={() => toggleSelection(camera._id)}
                />
              </label>
              <div>
                <strong>{camera.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {camera.location?.address || 'No location'}
                </div>
              </div>
              <span style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                {camera.type}
              </span>
              <span
                className={`${styles.statusBadge} ${styles.listStatusBadge} ${styles[camera.status]}`}
                title={`Status: ${camera.status} | Last seen: ${formatLastSeen(camera.lastSeen)}`}
              >
                {camera.status}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {camera.vms?.serverId ? 'Connected' : 'Manual'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {formatLastSeen(camera.lastSeen)}
              </span>
              <div className={styles.cameraActions}>
                <button
                  className={`${styles.actionButton} ${styles.primary}`}
                  onClick={() => openLiveView(camera)}
                  disabled={camera.status !== 'online'}
                >
                  View
                </button>
                <Link className={styles.actionButton} to={`/cameras/${camera._id}`}>
                  Details
                </Link>
                <button
                  className={styles.actionButton}
                  onClick={() => openModal(camera)}
                >
                  Edit
                </button>
                <button
                  className={styles.actionButton}
                  onClick={() => handleDelete(camera)}
                >
                  Delete
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
                Close
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
                  <label className={styles.formLabel}>Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="comma-separated tags (e.g., entrance, lobby)"
                  />
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
                Live: {liveViewCamera.name}
              </h2>
              <button
                className={styles.closeButton}
                onClick={() => setLiveViewCamera(null)}
              >
                Close
              </button>
            </div>
            <LiveView
              streamUrl={getStreamUrl(liveViewCamera) || ''}
              // TEST-ONLY: Provide embed URL fallback when HLS is unsupported.
              embedUrl={streamOverrides[liveViewCamera._id]?.embed}
              cameraName={liveViewCamera.name}
              snapshotUrl={streamOverrides[liveViewCamera._id]?.snapshot || liveViewCamera.streamUrl}
              className={styles.liveViewVideo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
