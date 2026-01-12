import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Event, Report } from '../services/api';
import { websocketService, WebSocketEvent } from '../services/websocket';
import styles from './EventDetailPage.module.css';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportIdToLink, setReportIdToLink] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [availableReports, setAvailableReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  const loadEvent = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.events.get(id);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
      console.error('[EventDetailPage] Error loading event:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
    loadAvailableReports();
  }, [id]);

  const loadAvailableReports = async () => {
    try {
      setLoadingReports(true);
      const response = await api.reports.list({ 
        pageSize: 1000,
        status: 'verified' // Only show verified reports
      });
      setAvailableReports(response.data || []);
    } catch (err: any) {
      console.error('[EventDetailPage] Error loading reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribe = websocketService.on(WebSocketEvent.EVENT_UPDATED, (data: Event) => {
      if (data._id === id) {
        console.log('[EventDetailPage] Event updated via WebSocket:', data);
        setEvent(data);
      }
    });

    return unsubscribe;
  }, [id]);

  const handleStatusChange = async (newStatus: 'active' | 'assigned' | 'resolved' | 'closed') => {
    if (!id || !event) return;
    
    const confirmMessage = `Are you sure you want to change status to "${newStatus}"?`;
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setActionLoading(true);
      const updated = await api.events.updateStatus(id, newStatus);
      setEvent(updated);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority: 'low' | 'medium' | 'high' | 'critical') => {
    if (!id || !event) return;
    
    try {
      setActionLoading(true);
      const updated = await api.events.update(id, { priority: newPriority });
      setEvent(updated);
      setShowPriorityDropdown(false);
    } catch (err: any) {
      alert(`Failed to update priority: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkReport = async () => {
    if (!id || !reportIdToLink.trim()) return;
    
    try {
      setActionLoading(true);
      const updated = await api.events.linkReport(id, reportIdToLink.trim());
      setEvent(updated);
      setReportIdToLink('');
      // Reload available reports to update the filtered list
      await loadAvailableReports();
      // Reload the full event to ensure linkedReports count is accurate
      await loadEvent();
    } catch (err: any) {
      if (err.message?.includes('already linked')) {
        alert('This report is already linked to this event.');
      } else {
        alert(`Failed to link report: ${err.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkReport = async (reportId: string) => {
    if (!id) return;
    
    if (!window.confirm('Are you sure you want to unlink this report?')) return;
    
    try {
      setActionLoading(true);
      const updated = await api.events.unlinkReport(id, reportId);
      setEvent(updated);
      // Reload available reports to update the filtered list
      await loadAvailableReports();
      // Reload the full event to ensure linkedReports count is accurate
      await loadEvent();
    } catch (err: any) {
      alert(`Failed to unlink report: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return styles.statusActive;
      case 'assigned': return styles.statusAssigned;
      case 'resolved': return styles.statusResolved;
      case 'closed': return styles.statusClosed;
      default: return '';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'low': return styles.priorityLow;
      case 'medium': return styles.priorityMedium;
      case 'high': return styles.priorityHigh;
      case 'critical': return styles.priorityCritical;
      default: return '';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className={styles.loading}>Loading event...</div>;
  }

  if (error || !event) {
    return (
      <div className={styles.eventDetailPage}>
        <div className={styles.error}>{error || 'Event not found'}</div>
        <button className={styles.secondaryButton} onClick={() => navigate('/events')}>
          Back to Events
        </button>
      </div>
    );
  }

  const canAssign = event.status === 'active';
  const canResolve = event.status === 'assigned';
  const canClose = event.status === 'resolved';
  const canReopen = event.status === 'closed';

  return (
    <div className={styles.eventDetailPage}>
      <button className={styles.backButton} onClick={() => navigate('/events')}>
        ← Back to Events
      </button>

      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>{event.title}</h1>
          {event.description && (
            <p className={styles.description}>{event.description}</p>
          )}
          <div className={styles.badges}>
            <span className={`${styles.badge} ${getStatusClass(event.status)}`}>
              {event.status}
            </span>
            <div className={styles.priorityContainer}>
              <span 
                className={`${styles.badge} ${getPriorityClass(event.priority)} ${styles.clickable}`}
                onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                title="Click to change priority"
              >
                {event.priority}
              </span>
              {showPriorityDropdown && (
                <div className={styles.priorityDropdown}>
                  <button onClick={() => handlePriorityChange('low')}>Low</button>
                  <button onClick={() => handlePriorityChange('medium')}>Medium</button>
                  <button onClick={() => handlePriorityChange('high')}>High</button>
                  <button onClick={() => handlePriorityChange('critical')}>Critical</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          {canAssign && (
            <button 
              className={styles.primaryButton}
              onClick={() => handleStatusChange('assigned')}
              disabled={actionLoading}
            >
              Assign
            </button>
          )}
          {canResolve && (
            <button 
              className={styles.successButton}
              onClick={() => handleStatusChange('resolved')}
              disabled={actionLoading}
            >
              Resolve
            </button>
          )}
          {canClose && (
            <button 
              className={styles.secondaryButton}
              onClick={() => handleStatusChange('closed')}
              disabled={actionLoading}
            >
              Close
            </button>
          )}
          {canReopen && (
            <button 
              className={styles.primaryButton}
              onClick={() => handleStatusChange('active')}
              disabled={actionLoading}
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainColumn}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Event Details</h2>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Created</span>
                <span className={styles.infoValue}>{formatDate(event.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Created By</span>
                <span className={styles.infoValue}>
                  {event.createdBy.firstName} {event.createdBy.lastName}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Location</span>
                <span className={styles.infoValue}>
                  {event.locationDescription || `${event.location.coordinates[1]}, ${event.location.coordinates[0]}`}
                </span>
              </div>
              {event.assignedTo && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Assigned To</span>
                    <span className={styles.infoValue}>
                      {event.assignedTo.firstName} {event.assignedTo.lastName}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Assigned At</span>
                    <span className={styles.infoValue}>{formatDate(event.assignedAt)}</span>
                  </div>
                </>
              )}
              {event.resolvedBy && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Resolved By</span>
                    <span className={styles.infoValue}>
                      {event.resolvedBy.firstName} {event.resolvedBy.lastName}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Resolved At</span>
                    <span className={styles.infoValue}>{formatDate(event.resolvedAt)}</span>
                  </div>
                </>
              )}
              {event.closedBy && (
                <>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Closed By</span>
                    <span className={styles.infoValue}>
                      {event.closedBy.firstName} {event.closedBy.lastName}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Closed At</span>
                    <span className={styles.infoValue}>{formatDate(event.closedAt)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Linked Reports ({event.linkedReports?.length || 0})</h2>
            
            {event.status !== 'closed' && (
              <div className={styles.linkReportSection}>
                <div className={styles.inputModeToggle}>
                  <button 
                    className={!useManualInput ? styles.active : ''}
                    onClick={() => setUseManualInput(false)}
                  >
                    Select from list
                  </button>
                  <button 
                    className={useManualInput ? styles.active : ''}
                    onClick={() => setUseManualInput(true)}
                  >
                    Enter ID manually
                  </button>
                </div>
                
                {useManualInput ? (
                  <input
                    type="text"
                    placeholder="Enter report ID..."
                    value={reportIdToLink}
                    onChange={(e) => setReportIdToLink(e.target.value)}
                    className={styles.reportInput}
                  />
                ) : (
                  <select
                    value={reportIdToLink}
                    onChange={(e) => setReportIdToLink(e.target.value)}
                    disabled={loadingReports}
                    className={styles.reportSelect}
                  >
                    <option value="">
                      {loadingReports ? 'Loading reports...' : 'Select a report to link...'}
                    </option>
                    {availableReports
                      .filter(r => !event.linkedReports?.some((lr: any) => 
                        (typeof lr === 'string' ? lr : lr._id) === r._id
                      ))
                      .map(report => (
                        <option key={report._id} value={report._id}>
                          {report.title} (ID: {report._id.slice(-8)}) - {report.type}
                        </option>
                      ))}
                  </select>
                )}
                
                <button 
                  className={styles.primaryButton}
                  onClick={handleLinkReport}
                  disabled={!reportIdToLink.trim() || actionLoading || loadingReports}
                >
                  Link Report
                </button>
              </div>
            )}

            <div className={styles.reportsList}>
              {event.linkedReports && event.linkedReports.length > 0 ? (
                event.linkedReports.map((report: any) => {
                  const reportId = typeof report === 'string' ? report : report._id;
                  const reportData = typeof report === 'string' ? null : report as Report;

                  return (
                    <div key={reportId} className={styles.reportCard}>
                      <h4 className={styles.reportTitle}>
                        {reportData?.title || `Report ID: ${reportId}`}
                      </h4>
                      {reportData && (
                        <p className={styles.reportMeta}>
                          {reportData.type} • {reportData.status} • {formatDate(reportData.createdAt)}
                        </p>
                      )}
                      {event.status !== 'closed' && (
                        <button
                          className={styles.unlinkButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlinkReport(reportId);
                          }}
                          disabled={actionLoading}
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className={styles.empty}>No reports linked to this event</p>
              )}
            </div>
          </section>
        </div>

        <div className={styles.sidebar}>
          {event.notes && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Notes</h3>
              <p>{event.notes}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
