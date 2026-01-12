import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, Report, PaginatedResponse } from '../services/api';
import styles from './ReportsPage.module.css';

interface LocationState {
  message?: string;
  reportId?: string;
}

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalReports, setTotalReports] = useState(0);
  const [limit] = useState(10);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    // Show success message from location state
    if (locationState?.message) {
      setSuccessMessage(locationState.message);
      // Clear the state to prevent showing message on refresh
      navigate(location.pathname, { replace: true, state: {} });
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    }
  }, [locationState, navigate, location.pathname]);

  useEffect(() => {
    loadReports();
  }, [currentPage, statusFilter, typeFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        page: currentPage,
        limit,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }

      const response = await api.reports.list(params) as PaginatedResponse<Report>;
      
      setReports(response.data);
      setCurrentPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
      setTotalReports(response.meta.total);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, action: 'verify' | 'reject') => {
    try {
      if (action === 'verify') {
        await api.reports.verify(reportId);
      } else {
        const reason = prompt('Please provide a rejection reason:');
        if (!reason) return;
        await api.reports.reject(reportId, reason);
      }
      
      // Reload reports to reflect changes
      await loadReports();
      
      setSuccessMessage(`Report ${action === 'verify' ? 'verified' : 'rejected'} successfully.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(`Error ${action}ing report:`, err);
      setError(`Failed to ${action} report. Please try again.`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusClass = {
      pending: styles.statusPending,
      verified: styles.statusVerified,
      rejected: styles.statusRejected,
    }[status] || styles.statusPending;

    return <span className={`${styles.statusBadge} ${statusClass}`}>{status}</span>;
  };

  const getTypeBadge = (type: string) => {
    const typeLabels = {
      incident: 'Security Incident',
      maintenance: 'Maintenance',
      safety: 'Safety Concern',
      other: 'Other',
    };

    return (
      <span className={styles.typeBadge}>
        {typeLabels[type as keyof typeof typeLabels] || type}
      </span>
    );
  };

  if (loading && reports.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading reports...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Reports</h1>
          <p>Manage citizen reports and incident submissions</p>
        </div>
        <button
          onClick={() => navigate('/reports/new')}
          className={styles.newReportButton}
        >
          Submit New Report
        </button>
      </div>

      {successMessage && (
        <div className={styles.success}>{successMessage}</div>
      )}

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="statusFilter">Status:</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="typeFilter">Type:</label>
          <select
            id="typeFilter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Types</option>
            <option value="incident">Security Incident</option>
            <option value="maintenance">Maintenance</option>
            <option value="safety">Safety Concern</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className={styles.resultsInfo}>
          Showing {reports.length} of {totalReports} reports
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No reports found matching your criteria.</p>
          <button
            onClick={() => navigate('/reports/new')}
            className={styles.emptyStateButton}
          >
            Submit the first report
          </button>
        </div>
      ) : (
        <div className={styles.reportsList}>
          {reports.map((report) => (
            <div key={report._id} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <div className={styles.reportTitle}>
                  <h3>{report.title}</h3>
                  <div className={styles.badges}>
                    {getStatusBadge(report.status)}
                    {getTypeBadge(report.type)}
                  </div>
                </div>
                <div className={styles.reportMeta}>
                  <span className={styles.reportDate}>
                    {formatDate(report.createdAt)}
                  </span>
                  <span className={styles.reportId}>#{report._id.slice(-6)}</span>
                </div>
              </div>

              <div className={styles.reportContent}>
                <p className={styles.reportDescription}>
                  {report.description.length > 200
                    ? `${report.description.substring(0, 200)}...`
                    : report.description}
                </p>

                {report.location && (
                  <div className={styles.reportLocation}>
                    📍 Location: {report.location.coordinates[1].toFixed(6)}, {report.location.coordinates[0].toFixed(6)}
                  </div>
                )}

                {report.attachments && report.attachments.length > 0 && (
                  <div className={styles.attachmentsInfo}>
                    📎 {report.attachments.length} attachment{report.attachments.length > 1 ? 's' : ''}
                  </div>
                )}

                {report.rejectionReason && (
                  <div className={styles.rejectionReason}>
                    <strong>Rejection Reason:</strong> {report.rejectionReason}
                  </div>
                )}
              </div>

              <div className={styles.reportActions}>
                <button
                  onClick={() => navigate(`/reports/${report._id}`)}
                  className={styles.viewButton}
                >
                  View Details
                </button>

                {report.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(report._id, 'verify')}
                      className={styles.verifyButton}
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleStatusChange(report._id, 'reject')}
                      className={styles.rejectButton}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            Previous
          </button>

          <div className={styles.pageNumbers}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  className={`${styles.pageButton} ${
                    currentPage === pageNumber ? styles.activePage : ''
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={styles.pageButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;