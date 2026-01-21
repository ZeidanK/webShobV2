import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, VmsServer, VmsMonitor, ApiRequestError, VmsCapabilities } from '../services/api';
import styles from './VmsSettingsPage.module.css';

type VmsProvider = 'shinobi' | 'zoneminder' | 'agentdvr' | 'milestone' | 'genetec' | 'other';

interface VmsFormData {
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  // Public base URL for browser stream access (optional).
  publicBaseUrl: string;
  isActive: boolean;
  apiKey: string;
  groupKey: string;
  username: string;
  password: string;
  sdkConfig: string;
}

const defaultFormData: VmsFormData = {
  name: '',
  provider: 'shinobi',
  baseUrl: '',
  publicBaseUrl: '',
  isActive: true,
  apiKey: '',
  groupKey: '',
  username: '',
  password: '',
  sdkConfig: '',
};

// Normalize API errors to include codes for troubleshooting.
const formatApiError = (err: unknown, fallback: string) => {
  if (err instanceof ApiRequestError) {
    return `${fallback} (${err.code}): ${err.message}`;
  }
  if (err instanceof Error) {
    return `${fallback}: ${err.message}`;
  }
  return fallback;
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
  // TEST-ONLY: Track per-server capability flags for stubbed adapters.
  const [capabilitiesByServer, setCapabilitiesByServer] = useState<Record<string, VmsCapabilities | null>>({});
  const [capabilitiesLoading, setCapabilitiesLoading] = useState<Record<string, boolean>>({});
  // TEST-ONLY: Track cleanup action per VMS server.
  const [cleaning, setCleaning] = useState<string | null>(null);
  // TEST-ONLY: Flag providers that are stubbed in Slice 11.
  const isComingSoonProvider = (provider: VmsProvider) => provider === 'milestone' || provider === 'genetec';

  // TEST-ONLY: Resolve adapter capabilities for each server to gate UI actions.
  const fetchCapabilities = useCallback(async (serversData: VmsServer[]) => {
    if (serversData.length === 0) {
      setCapabilitiesByServer({});
      setCapabilitiesLoading({});
      return;
    }

    const loadingFlags = serversData.reduce<Record<string, boolean>>((acc, server) => {
      acc[server._id] = true;
      return acc;
    }, {});
    setCapabilitiesLoading(loadingFlags);

    const entries = await Promise.all(
      serversData.map(async (server) => {
        try {
          const result = await api.vms.capabilities(server._id);
          return [server._id, result.capabilities] as const;
        } catch (err) {
          console.error('Failed to fetch VMS capabilities:', err);
          return [server._id, null] as const;
        }
      })
    );

    setCapabilitiesByServer((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    const doneFlags = serversData.reduce<Record<string, boolean>>((acc, server) => {
      acc[server._id] = false;
      return acc;
    }, {});
    setCapabilitiesLoading((prev) => ({ ...prev, ...doneFlags }));
  }, []);

  // Fetch VMS servers
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const serversData = await api.vms.list();
      setServers(serversData || []);
      // TEST-ONLY: Refresh capability cache whenever servers reload.
      await fetchCapabilities(serversData || []);
    } catch (err) {
      console.error('Failed to fetch VMS servers:', err);
      setError('Failed to load VMS servers.');
    } finally {
      setLoading(false);
    }
  }, [fetchCapabilities]);

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
        publicBaseUrl: server.publicBaseUrl || '',
        isActive: server.isActive,
        apiKey: '', // Don't populate - security
        groupKey: '',
        username: '',
        password: '',
        sdkConfig: server.sdkConfig ? JSON.stringify(server.sdkConfig, null, 2) : '',
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

      let parsedSdkConfig: Record<string, unknown> | undefined;
      // TEST-ONLY: Parse Genetec SDK config input as JSON.
      if (formData.provider === 'genetec' && formData.sdkConfig.trim()) {
        try {
          parsedSdkConfig = JSON.parse(formData.sdkConfig);
        } catch (err) {
          alert(formatApiError(err, 'SDK config must be valid JSON'));
          setSaving(false);
          return;
        }
      }
      
      const serverData = {
        name: formData.name,
        provider: formData.provider,
        // Single URL support: backend will normalize localhost for Docker.
        baseUrl: formData.baseUrl,
        // Public base URL for browser stream access (optional).
        publicBaseUrl: formData.publicBaseUrl || undefined,
        sdkConfig: parsedSdkConfig,
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
      alert(formatApiError(err, 'Failed to save VMS server'));
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
      alert(formatApiError(err, 'Failed to delete VMS server'));
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
        message: formatApiError(err, errorMessage),
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
      alert(formatApiError(err, 'Failed to discover monitors from VMS'));
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
      alert(formatApiError(err, 'Failed to import camera'));
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
      alert(formatApiError(err, 'Failed to import cameras'));
    }
  };

  // TEST-ONLY: Remove imported demo cameras for a VMS server.
  const handleCleanupImported = async (server: VmsServer) => {
    const ok = confirm(`Remove imported cameras from ${server.name}?`);
    if (!ok) {
      return;
    }

    try {
      setCleaning(server._id);
      const result = await api.deleteCamerasBySource('vms-import');
      alert(`Deleted ${result.deletedCount} imported camera(s).`);
      fetchServers();
    } catch (err) {
      console.error('Failed to cleanup imported cameras:', err);
      alert(formatApiError(err, 'Failed to cleanup imported cameras'));
    } finally {
      setCleaning(null);
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
      <Link to="/cameras" className={styles.backLink}>\n        Back to Cameras\n      </Link>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>VMS Settings</h1>
        <button className={styles.addButton} onClick={() => openModal()}>
          + Add VMS Server
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.emptyState}>\n          <span>Error</span>
          <h3>Error</h3>
          <p>{error}</p>
          <button className={styles.addButton} onClick={fetchServers}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!error && servers.length === 0 && (
        <div className={styles.emptyState}>\n          <span>Error</span>
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
          {servers.map((server) => {
            const isComingSoon = isComingSoonProvider(server.provider);
            const capabilities = capabilitiesByServer[server._id];
            const isCapabilitiesLoading = capabilitiesLoading[server._id];

            return (
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
                    disabled={testing === server._id || isComingSoon}
                  >
                    {testing === server._id ? '...' : 'Test'}
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleDiscoverMonitors(server)}
                    disabled={loadingMonitors === server._id || isComingSoon}
                  >
                    {loadingMonitors === server._id ? '...' : 'Discover'}
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => openModal(server)}
                  >
                    Edit
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.danger}`}
                    onClick={() => handleDelete(server)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isComingSoon && (
                <div className={styles.comingSoonBanner}>
                  Coming soon: {server.provider} adapter is stubbed in Slice 11.
                </div>
              )}

              <div className={styles.serverDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Base URL:</span>
                  <span className={styles.detailValue}>{server.baseUrl}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Provider:</span>
                  <span className={styles.detailValue}>{server.provider}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Capabilities:</span>
                  <div className={styles.capabilityPills}>
                    {isCapabilitiesLoading ? (
                      <span className={styles.capabilityLoading}>Loading...</span>
                    ) : (
                      <>
                        <span
                          className={`${styles.capabilityPill} ${capabilities?.supportsLive ? styles.capabilityEnabled : styles.capabilityDisabled}`}
                        >
                          Live
                        </span>
                        <span
                          className={`${styles.capabilityPill} ${capabilities?.supportsPlayback ? styles.capabilityEnabled : styles.capabilityDisabled}`}
                        >
                          Playback
                        </span>
                        <span
                          className={`${styles.capabilityPill} ${capabilities?.supportsExport ? styles.capabilityEnabled : styles.capabilityDisabled}`}
                        >
                          Export
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Result */}
              {testResult && testResult.serverId === server._id && (
                <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.error}`}>
                  {testResult.success ? 'OK' : 'Failed'} {testResult.message}
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
                        disabled={isComingSoon}
                      >
                        Import All
                      </button>
                      {/* TEST-ONLY: Cleanup imported demo cameras for this VMS. */}
                      <button
                        className={`${styles.actionButton} ${styles.danger}`}
                        onClick={() => handleCleanupImported(server)}
                        disabled={cleaning === server._id}
                      >
                        {cleaning === server._id ? '...' : 'Cleanup Imported'}
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
                          disabled={isComingSoon}
                        >
                          Import
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )})}
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
                Close
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
                      <option value="milestone">Milestone</option>
                      <option value="genetec">Genetec</option>
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
                    Single URL is OK for testing; Docker will normalize localhost.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Public Base URL</label>
                  <input
                    type="url"
                    value={formData.publicBaseUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, publicBaseUrl: e.target.value })
                    }
                    className={styles.formInput}
                    placeholder="http://localhost:8080"
                  />
                  <p className={styles.formHint}>
                    Browser-facing URL used for stream playback (optional)
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

                  {isComingSoonProvider(formData.provider) && (
                    <div className={styles.comingSoonNote}>
                      Provider support is stubbed. Configuration is saved, but test/discovery is disabled.
                    </div>
                  )}
                  
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
                      {formData.provider === 'genetec' && (
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>SDK Config (JSON)</label>
                          <textarea
                            value={formData.sdkConfig}
                            onChange={(e) =>
                              setFormData({ ...formData, sdkConfig: e.target.value })
                            }
                            className={styles.formInput}
                            rows={6}
                            placeholder='{"server":"127.0.0.1","site":"default"}'
                          />
                          <p className={styles.formHint}>
                            Provide Genetec SDK settings as JSON (optional for now).
                          </p>
                        </div>
                      )}
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







