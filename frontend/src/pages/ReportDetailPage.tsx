import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Report } from '../services/api';
import styles from './ReportDetailPage.module.css';

const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadReport(id);
    }
  }, [id]);

  const loadReport = async (reportId: string) => {
    try {
      setLoading(true);
      setError('');
      const reportData = await api.reports.get(reportId);
      setReport(reportData);
    } catch (err) {
      console.error('Error loading report:', err);
      setError('Failed to load report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (action: 'verify' | 'reject') => {
    if (!report) return;

    try {
      setActionLoading(action);

      if (action === 'verify') {
        await api.reports.verify(report._id);
        setReport({ ...report, status: 'verified', verifiedAt: new Date().toISOString() });
      } else {
        const reason = prompt('Please provide a rejection reason:');
        if (!reason) {
          setActionLoading('');
          return;
        }
        await api.reports.reject(report._id, reason);
        setReport({ 
          ...report, 
          status: 'rejected', 
          rejectionReason: reason,
          verifiedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`Error ${action}ing report:`, err);
      setError(`Failed to ${action} report. Please try again.`);
    } finally {
      setActionLoading('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { class: styles.statusPending, label: 'Pending Review' },
      verified: { class: styles.statusVerified, label: 'Verified' },
      rejected: { class: styles.statusRejected, label: 'Rejected' },
    }[status] || { class: styles.statusPending, label: 'Unknown' };

    return (
      <span className={`${styles.statusBadge} ${statusConfig.class}`}>
        {statusConfig.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeLabels = {
      incident: 'Security Incident',
      maintenance: 'Maintenance Request',
      safety: 'Safety Concern',
      other: 'Other',
    };

    const typeIcons = {
      incident: '🚨',
      maintenance: '🔧',
      safety: '⚠️',
      other: '📝',
    };

    return (
      <span className={styles.typeBadge}>
        <span className={styles.typeIcon}>
          {typeIcons[type as keyof typeof typeIcons] || '📝'}
        </span>
        {typeLabels[type as keyof typeof typeLabels] || type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error || 'Report not found'}
        </div>
        <button onClick={() => navigate('/reports')} className={styles.backButton}>
          ← Back to Reports
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/reports')} className={styles.backButton}>
          ← Back to Reports
        </button>
        <div className={styles.headerInfo}>
          <h1>{report.title}</h1>
          <div className={styles.headerMeta}>
            <span className={styles.reportId}>Report #{report._id.slice(-8).toUpperCase()}</span>
            <span className={styles.reportDate}>
              Submitted {formatDate(report.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainSection}>
          <div className={styles.reportDetails}>
            <div className={styles.statusSection}>
              <div className={styles.badges}>
                {getStatusBadge(report.status)}
                {getTypeBadge(report.type)}
              </div>
              
              {report.status === 'pending' && (
                <div className={styles.actions}>
                  <button
                    onClick={() => handleStatusChange('verify')}
                    disabled={!!actionLoading}
                    className={styles.verifyButton}
                  >
                    {actionLoading === 'verify' ? 'Verifying...' : 'Verify Report'}
                  </button>
                  <button
                    onClick={() => handleStatusChange('reject')}
                    disabled={!!actionLoading}
                    className={styles.rejectButton}
                  >
                    {actionLoading === 'reject' ? 'Rejecting...' : 'Reject Report'}
                  </button>
                </div>
              )}
            </div>

            <div className={styles.section}>
              <h2>Description</h2>
              <p className={styles.description}>{report.description}</p>
            </div>

            {report.location && (
              <div className={styles.section}>
                <h2>Location</h2>
                <div className={styles.locationInfo}>
                  <div className={styles.coordinates}>
                    <span className={styles.coordinateLabel}>Coordinates:</span>
                    <span className={styles.coordinateValue}>
                      {report.location.coordinates[1].toFixed(6)}, {report.location.coordinates[0].toFixed(6)}
                    </span>
                  </div>
                  {report.location.accuracy && (
                    <div className={styles.accuracy}>
                      Accuracy: ±{Math.round(report.location.accuracy)}m
                    </div>
                  )}
                  <div className={styles.mapPlaceholder}>
                    📍 Map view would be displayed here
                  </div>
                </div>
              </div>
            )}

            {report.attachments && report.attachments.length > 0 && (
              <div className={styles.section}>
                <h2>Attachments ({report.attachments.length})</h2>
                <div className={styles.attachments}>
                  {report.attachments.map((attachment, index) => (
                    <div key={index} className={styles.attachment}>
                      <div className={styles.attachmentPreview}>
                        {attachment.mimeType.startsWith('image/') ? (
                          <img
                            src={attachment.thumbnailUrl || attachment.url}
                            alt={attachment.originalName}
                            className={styles.attachmentImage}
                            onClick={() => window.open(attachment.url, '_blank')}
                          />
                        ) : (
                          <div className={styles.attachmentPlaceholder}>
                            🎥 Video
                          </div>
                        )}
                      </div>
                      <div className={styles.attachmentInfo}>
                        <div className={styles.attachmentName}>
                          {attachment.originalName}
                        </div>
                        <div className={styles.attachmentMeta}>
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                        <button
                          onClick={() => window.open(attachment.url, '_blank')}
                          className={styles.viewAttachmentButton}
                        >
                          View Full Size
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.rejectionReason && (
              <div className={styles.section}>
                <h2>Rejection Details</h2>
                <div className={styles.rejectionReason}>
                  <strong>Reason:</strong> {report.rejectionReason}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h3>Report Information</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status:</span>
                <span className={styles.infoValue}>{report.status}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Type:</span>
                <span className={styles.infoValue}>{report.type}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Submitted:</span>
                <span className={styles.infoValue}>{formatDate(report.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Updated:</span>
                <span className={styles.infoValue}>{formatDate(report.updatedAt)}</span>
              </div>
              {report.verifiedAt && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>
                    {report.status === 'verified' ? 'Verified:' : 'Processed:'}
                  </span>
                  <span className={styles.infoValue}>{formatDate(report.verifiedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {report.reportedBy && (
            <div className={styles.sidebarSection}>
              <h3>Reported By</h3>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {report.reportedBy.firstName} {report.reportedBy.lastName}
                </div>
                <div className={styles.userEmail}>
                  {report.reportedBy.email}
                </div>
                <div className={styles.userRole}>
                  Role: {report.reportedBy.role}
                </div>
              </div>
            </div>
          )}

          {report.verifiedBy && (
            <div className={styles.sidebarSection}>
              <h3>
                {report.status === 'verified' ? 'Verified By' : 'Processed By'}
              </h3>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {report.verifiedBy.firstName} {report.verifiedBy.lastName}
                </div>
                <div className={styles.userEmail}>
                  {report.verifiedBy.email}
                </div>
                <div className={styles.userRole}>
                  Role: {report.verifiedBy.role}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDetailPage;