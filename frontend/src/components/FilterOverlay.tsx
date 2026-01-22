import { useState } from 'react';
import styles from './FilterOverlay.module.css';

export interface MapFilters {
  display: {
    showEvents: boolean;
    showReports: boolean;
    showCameras: boolean;
    clusterCameras: boolean;
  };
  events: {
    status: string[];
    priority: string[];
    dateRange: { start: Date; end: Date } | null;
  };
  cameras: {
    status: string[];
    hasVms: boolean | null;
    search: string;
  };
  reports: {
    status: string[];
  };
}

interface FilterOverlayProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onClose: () => void;
  eventCount: number;
  cameraCount: number;
  reportCount: number;
  cameraCounts: {
    online: number;
    offline: number;
    maintenance: number;
    error: number;
  };
  eventCounts: {
    active: number;
    assigned: number;
    resolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  reportCounts: {
    pending: number;
    verified: number;
    rejected: number;
  };
}

export function FilterOverlay({
  filters,
  onFiltersChange,
  onClose,
  eventCount,
  cameraCount,
  reportCount,
  cameraCounts,
  eventCounts,
  reportCounts,
}: FilterOverlayProps) {
  // Calculate active filter counts
  const activeEventFilters = filters.events.status.length + filters.events.priority.length;
  const activeCameraFilters = filters.cameras.status.length + (filters.cameras.search ? 1 : 0);
  const activeReportFilters = filters.reports.status.length;

  // Toggle functions
  const handleDisplayToggle = (key: keyof MapFilters['display']) => {
    onFiltersChange({
      ...filters,
      display: {
        ...filters.display,
        [key]: !filters.display[key],
      },
    });
  };

  const handleEventStatusToggle = (status: string) => {
    const newStatus = filters.events.status.includes(status)
      ? filters.events.status.filter((s) => s !== status)
      : [...filters.events.status, status];
    onFiltersChange({
      ...filters,
      events: {
        ...filters.events,
        status: newStatus,
      },
    });
  };

  const handleEventPriorityToggle = (priority: string) => {
    const newPriority = filters.events.priority.includes(priority)
      ? filters.events.priority.filter((p) => p !== priority)
      : [...filters.events.priority, priority];
    onFiltersChange({
      ...filters,
      events: {
        ...filters.events,
        priority: newPriority,
      },
    });
  };

  const handleCameraStatusToggle = (status: string) => {
    const newStatus = filters.cameras.status.includes(status)
      ? filters.cameras.status.filter((s) => s !== status)
      : [...filters.cameras.status, status];
    onFiltersChange({
      ...filters,
      cameras: {
        ...filters.cameras,
        status: newStatus,
      },
    });
  };

  const handleCameraSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      cameras: {
        ...filters.cameras,
        search,
      },
    });
  };

  const handleReportStatusToggle = (status: string) => {
    const newStatus = filters.reports.status.includes(status)
      ? filters.reports.status.filter((s) => s !== status)
      : [...filters.reports.status, status];
    onFiltersChange({
      ...filters,
      reports: {
        ...filters.reports,
        status: newStatus,
      },
    });
  };

  const handleReset = () => {
    onFiltersChange({
      display: {
        showEvents: true,
        showReports: false,
        showCameras: true,
        clusterCameras: true,
      },
      events: {
        status: [],
        priority: [],
        dateRange: null,
      },
      cameras: {
        status: [],
        hasVms: null,
        search: '',
      },
      reports: {
        status: [],
      },
    });
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.filterPanel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Map Filters</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {/* EVENTS SECTION */}
          <div className={styles.categorySection}>
            <div className={styles.categoryHeader}>
              <div className={styles.categoryTitle}>
                <div className={styles.categoryInfo}>
                  <div className={styles.categoryName}>Events</div>
                  <div className={styles.categoryCount}>
                    {eventCount} total
                    {eventCounts.critical > 0 && (
                      <span className={styles.criticalBadge}>
                        {eventCounts.critical} critical
                      </span>
                    )}
                  </div>
                </div>
                {activeEventFilters > 0 && (
                  <span className={styles.activeFilterBadge}>{activeEventFilters}</span>
                )}
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={filters.display.showEvents}
                  onChange={() => handleDisplayToggle('showEvents')}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            {filters.display.showEvents && (
              <div className={styles.nestedFilters}>
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Status</div>
                  <div className={styles.chipGroup}>
                    {['active', 'investigating', 'resolved', 'closed'].map((status) => (
                      <button
                        key={status}
                        className={`${styles.chip} ${
                          filters.events.status.includes(status) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleEventStatusToggle(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Priority</div>
                  <div className={styles.chipGroup}>
                    {[
                      { value: 'critical', count: eventCounts.critical },
                      { value: 'high', count: eventCounts.high },
                      { value: 'medium', count: eventCounts.medium },
                      { value: 'low', count: eventCounts.low },
                    ].map(({ value, count }) => (
                      <button
                        key={value}
                        className={`${styles.chip} ${styles[`chip${value.charAt(0).toUpperCase() + value.slice(1)}`]} ${
                          filters.events.priority.includes(value) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleEventPriorityToggle(value)}
                        disabled={count === 0}
                      >
                        {value === 'critical' && '⚠️ '}
                        {value === 'high' && '🔴 '}
                        {value === 'medium' && '🟡 '}
                        {value === 'low' && '🟢 '}
                        {value} ({count})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CAMERAS SECTION */}
          <div className={styles.categorySection}>
            <div className={styles.categoryHeader}>
              <div className={styles.categoryTitle}>
                <div className={styles.categoryInfo}>
                  <div className={styles.categoryName}>Cameras</div>
                  <div className={styles.categoryCount}>
                    {cameraCount} total
                    {cameraCounts.online > 0 && (
                      <span className={styles.onlineBadge}>
                        {cameraCounts.online} online
                      </span>
                    )}
                  </div>
                </div>
                {activeCameraFilters > 0 && (
                  <span className={styles.activeFilterBadge}>{activeCameraFilters}</span>
                )}
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={filters.display.showCameras}
                  onChange={() => handleDisplayToggle('showCameras')}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            {filters.display.showCameras && (
              <div className={styles.nestedFilters}>
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Camera Status</div>
                  <div className={styles.chipGroup}>
                    {[
                      { value: 'online', count: cameraCounts.online },
                      { value: 'offline', count: cameraCounts.offline },
                      { value: 'maintenance', count: cameraCounts.maintenance },
                      { value: 'error', count: cameraCounts.error },
                    ].map(({ value, count }) => (
                      <button
                        key={value}
                        className={`${styles.chip} ${styles[`chipCamera${value.charAt(0).toUpperCase() + value.slice(1)}`]} ${
                          filters.cameras.status.includes(value) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleCameraStatusToggle(value)}
                        disabled={count === 0}
                      >
                        {value === 'online' && '🟢 '}
                        {value === 'offline' && '🔴 '}
                        {value === 'maintenance' && '🟡 '}
                        {value === 'error' && '🟠 '}
                        {value} ({count})
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Search</div>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by name or location..."
                    value={filters.cameras.search}
                    onChange={(e) => handleCameraSearchChange(e.target.value)}
                  />
                </div>

                <div className={styles.filterGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.display.clusterCameras}
                      onChange={() => handleDisplayToggle('clusterCameras')}
                    />
                    <span>Cluster nearby cameras</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* REPORTS SECTION */}
          <div className={styles.categorySection}>
            <div className={styles.categoryHeader}>
              <div className={styles.categoryTitle}>
                <div className={styles.categoryInfo}>
                  <div className={styles.categoryName}>Reports</div>
                  <div className={styles.categoryCount}>
                    {reportCount} total
                    {reportCounts.pending > 0 && (
                      <span className={styles.pendingBadge}>
                        {reportCounts.pending} pending
                      </span>
                    )}
                  </div>
                </div>
                {activeReportFilters > 0 && (
                  <span className={styles.activeFilterBadge}>{activeReportFilters}</span>
                )}
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={filters.display.showReports}
                  onChange={() => handleDisplayToggle('showReports')}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            {filters.display.showReports && (
              <div className={styles.nestedFilters}>
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Status</div>
                  <div className={styles.chipGroup}>
                    {[
                      { value: 'pending', count: reportCounts.pending },
                      { value: 'verified', count: reportCounts.verified },
                      { value: 'rejected', count: reportCounts.rejected },
                    ].map(({ value, count }) => (
                      <button
                        key={value}
                        className={`${styles.chip} ${styles[`chipReport${value.charAt(0).toUpperCase() + value.slice(1)}`]} ${
                          filters.reports.status.includes(value) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleReportStatusToggle(value)}
                        disabled={count === 0}
                      >
                        {value === 'pending' && '🟡 '}
                        {value === 'verified' && '✅ '}
                        {value === 'rejected' && '❌ '}
                        {value} ({count})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.resetButton} onClick={handleReset}>
            Reset All
          </button>
          <button className={styles.applyButton} onClick={onClose}>
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
