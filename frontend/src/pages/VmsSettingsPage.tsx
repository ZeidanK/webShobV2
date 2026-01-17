import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, VmsServer, VmsMonitor } from '../services/api';
import styles from './VmsSettingsPage.module.css';

type VmsProvider = 'shinobi' | 'zoneminder' | 'agentdvr' | 'other';

interface VmsFormData {
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  isActive: boolean;
  apiKey: string;
  groupKey: string;
  username: string;
  password: string;
}

const defaultFormData: VmsFormData = {
  name: '',
  provider: 'shinobi',
  baseUrl: '',
  isActive: true,
  apiKey: '',
  groupKey: '',
  username: '',
  password: '',
};

export default function VmsSettingsPage() {
  const [servers, setServers] = useState<VmsServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<VmsServer | null>(null);
  const [formData, setFormData] = useState<VmsFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  
  // Test connection state
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ serverId: string; success: boolean; message: string } | null>(null);
  
  // Monitors state
  const [loadingMonitors, setLoadingMonitors] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<Record<string, VmsMonitor[]>>({});

  // Fetch VMS servers
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const serversData = await api.vms.list();
      setServers(serversData || []);
    } catch (err) {
      console.error('Failed to fetch VMS servers:', err);
      setError('Failed to load VMS servers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Open add/edit modal
  const openModal = (server?: VmsServer) => {
    if (server) {
      setEditingServer(server);
      setFormData({
        name: server.name,
        provider: server.provider,
        baseUrl: server.baseUrl,
        isActive: server.isActive,
        apiKey: '', // Don't populate - security
        groupKey: '',
        username: '',
        password: '',
      });
    } else {
      setEditingServer(null);
      setFormData(defaultFormData);
    }
    setShowModal(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const serverData = {
        name: formData.name,
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        isActive: formData.isActive,
        auth: formData.provider === 'shinobi' ? {
          apiKey: formData.apiKey || undefined,
          groupKey: formData.groupKey || undefined,
        } : {
          username: formData.username || undefined,
          password: formData.password || undefined,
        },
      };

      if (editingServer) {
        await api.vms.update(editingServer._id, serverData);
      } else {
        await api.vms.create(serverData);
      }

      setShowModal(false);
      fetchServers();
    } catch (err) {
      console.error('Failed to save VMS server:', err);
      alert('Failed to save VMS server. Please check your input.');
    } finally {
      setSaving(false);
    }
  };

  // Delete server
  const handleDelete = async (server: VmsServer) => {
    if (!confirm(`Are you sure you want to delete "${server.name}"?`)) {
      return;
    }

    try {
      await api.vms.delete(server._id);
      fetchServers();
    } catch (err) {
      console.error('Failed to delete VMS server:', err);
      alert('Failed to delete VMS server.');
    }
  };

  // Test connection
  const handleTestConnection = async (server: VmsServer) => {
    try {
      setTesting(server._id);
      setTestResult(null);
      
      const result = await api.vms.testConnection(server._id);
      setTestResult({
        serverId: server._id,
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed'),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setTestResult({
        serverId: server._id,
        success: false,
        message: errorMessage,
      });
    } finally {
      setTesting(null);
    }
  };

  // Discover monitors
  const handleDiscoverMonitors = async (server: VmsServer) => {
    try {
      setLoadingMonitors(server._id);
      const monitorsData = await api.vms.discoverMonitors(server._id);
      setMonitors(prev => ({
        ...prev,
        [server._id]: monitorsData || [],
      }));
    } catch (err) {
      console.error('Failed to discover monitors:', err);
      alert('Failed to discover monitors from VMS.');
    } finally {
      setLoadingMonitors(null);
    }
  };

  // Import single camera from VMS
  const handleImportCamera = async (server: VmsServer, monitor: VmsMonitor) => {
    try {
      await api.vms.importMonitors(server._id, {
        monitorIds: [monitor.id],
        defaultLocation: {
          coordinates: [0, 0],
          address: 'Imported from VMS',
        },
        source: 'vms-import',
      });
      alert(`Camera "${monitor.name}" imported successfully!`);
      // Refresh monitors to update imported status
      handleDiscoverMonitors(server);
    } catch (err) {
      console.error('Failed to import camera:', err);
      alert('Failed to import camera.');
    }
  };

  // Batch import all monitors from VMS
  const handleImportAllMonitors = async (server: VmsServer) => {
    const serverMonitors = monitors[server._id];
    if (!serverMonitors || serverMonitors.length === 0) {
      alert('No monitors discovered. Please discover monitors first.');
      return;
    }

    const confirmed = window.confirm(
      `Import all ${serverMonitors.length} monitor(s) from ${server.name}?`
    );
    if (!confirmed) return;

    try {
      const result = await api.vms.importMonitors(server._id, {
        defaultLocation: {
          coordinates: [0, 0],
          address: 'Imported from VMS',
        },
        source: 'vms-import',
      });
      alert(`Successfully imported ${result.length} camera(s)!`);
      // Refresh monitors
      handleDiscoverMonitors(server);
    } catch (err) {
      console.error('Failed to batch import:', err);
      alert('Failed to import cameras.');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading VMS servers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link to="/cameras" className={styles.backLink}>
        ← Back to Cameras
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>⚙️ VMS Settings</h1>
        <button className={styles.addButton} onClick={() => openModal()}>
          + Add VMS Server
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.emptyState}>
          <span>⚠️</span>
          <h3>Error</h3>
          <p>{error}</p>
          <button className={styles.addButton} onClick={fetchServers}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!error && servers.length === 0 && (
        <div className={styles.emptyState}>
          <span>🖥️</span>
          <h3>No VMS Servers Configured</h3>
          <p>Add a VMS server to connect cameras and view live streams.</p>
          <button className={styles.addButton} onClick={() => openModal()}>
            + Add VMS Server
          </button>
        </div>
      )}

      {/* Server List */}
      {!error && servers.length > 0 && (
        <div className={styles.serverGrid}>
          {servers.map((server) => (
            <div key={server._id} className={styles.serverCard}>
              <div className={styles.serverHeader}>
                <div className={styles.serverInfo}>
                  <h3>{server.name}</h3>
                  <div className={styles.serverMeta}>
                    <span className={`${styles.providerBadge} ${styles[server.provider]}`}>
                      {server.provider}
                    </span>
                    <span className={`${styles.statusIndicator} ${server.isActive ? styles.active : styles.inactive}`}>
                      {server.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className={styles.serverActions}>
                  <button
                    className={`${styles.actionButton} ${styles.primary}`}
                    onClick={() => handleTestConnection(server)}
                    disabled={testing === server._id}
                  >
                    {testing === server._id ? '...' : '🔌 Test'}
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDiscoverMonitors(server)}
                    disabled={loadingMonitors === server._id}
                  >
                    {loadingMonitors === server._id ? '...' : '🔍 Discover'}
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => openModal(server)}
                  >
                    ✏️
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.danger}`}
                    onClick={() => handleDelete(server)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={styles.serverDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Base URL:</span>
                  <span className={styles.detailValue}>{server.baseUrl}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Provider:</span>
                  <span className={styles.detailValue}>{server.provider}</span>
                </div>
              </div>

              {/* Test Result */}
              {testResult && testResult.serverId === server._id && (
                <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
                  {testResult.success ? '✓' : '✗'} {testResult.message}
                </div>
              )}

              {/* Discovered Monitors */}
              {monitors[server._id] && monitors[server._id].length > 0 && (
                <div className={styles.monitorsSection}>
                  <div className={styles.monitorsHeader}>
                    <h4 className={styles.monitorsTitle}>Discovered Cameras</h4>
                    <div className={styles.monitorsHeaderActions}>
                      <span className={styles.monitorCount}>
                        {monitors[server._id].length} found
                      </span>
                      <button
                        className={`${styles.actionButton} ${styles.primary}`}
                        onClick={() => handleImportAllMonitors(server)}
                      >
                        📥 Import All
                      </button>
                    </div>
                  </div>
                  <div className={styles.monitorGrid}>
                    {monitors[server._id].map((monitor) => (
                      <div key={monitor.id} className={styles.monitorCard}>
                        <h5 className={styles.monitorName}>{monitor.name}</h5>
                        <p className={styles.monitorId}>ID: {monitor.id}</p>
                        <button
                          className={styles.importButton}
                          onClick={() => handleImportCamera(server, monitor)}
                        >
                          📥 Import
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                {editingServer ? 'Edit VMS Server' : 'Add VMS Server'}
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
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Server Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={styles.formInput}
                    required
                    placeholder="e.g., Main Building Shinobi"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Provider *</label>
                    <select
                      value={formData.provider}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          provider: e.target.value as VmsProvider,
                        })
                      }
                      className={styles.formSelect}
                    >
                      <option value="shinobi">Shinobi</option>
                      <option value="zoneminder">ZoneMinder</option>
                      <option value="agentdvr">Agent DVR</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Status</label>
                    <select
                      value={formData.isActive ? 'active' : 'inactive'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isActive: e.target.value === 'active',
                        })
                      }
                      className={styles.formSelect}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Base URL *</label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, baseUrl: e.target.value })
                    }
                    className={styles.formInput}
                    required
                    placeholder="http://localhost:8080"
                  />
                  <p className={styles.formHint}>
                    The base URL of your VMS server (no trailing slash)
                  </p>
                </div>

                {/* Provider-specific auth fields */}
                <div className={styles.authSection}>
                  <h4 className={styles.authTitle}>
                    Authentication
                    {editingServer && (
                      <span style={{ fontWeight: 'normal', color: '#6b7280' }}>
                        {' '}(leave empty to keep existing)
                      </span>
                    )}
                  </h4>
                  
                  {formData.provider === 'shinobi' ? (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>API Key *</label>
                        <input
                          type="text"
                          value={formData.apiKey}
                          onChange={(e) =>
                            setFormData({ ...formData, apiKey: e.target.value })
                          }
                          className={styles.formInput}
                          placeholder="Shinobi API key"
                          required={!editingServer}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Group Key *</label>
                        <input
                          type="text"
                          value={formData.groupKey}
                          onChange={(e) =>
                            setFormData({ ...formData, groupKey: e.target.value })
                          }
                          className={styles.formInput}
                          placeholder="Shinobi group key"
                          required={!editingServer}
                        />
                        <p className={styles.formHint}>
                          Find these in Shinobi's API settings
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Username</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) =>
                            setFormData({ ...formData, username: e.target.value })
                          }
                          className={styles.formInput}
                          placeholder="VMS username"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Password</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          className={styles.formInput}
                          placeholder="VMS password"
                        />
                      </div>
                    </>
                  )}
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
                  disabled={saving || !formData.name || !formData.baseUrl}
                >
                  {saving ? 'Saving...' : editingServer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
