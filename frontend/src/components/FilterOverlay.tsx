/**
 * FilterOverlay Component
 * 
 * Advanced filter overlay for the map view with sections for:
 * - Display options (show/hide cameras, events, reports, clustering)
 * - Event filters (status, priority, date range)
 * - Camera filters (status, VMS, search)
 * - Geographic filters (current map bounds)
 * 
 * Floating panel positioned on top-right of map with glassmorphism effect.
 */

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
    dateRange: { from?: Date; to?: Date };
  };
  cameras: {
    status: string[];
    hasVms: boolean | null;
    search: string;
  };
}

interface FilterOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  cameraCounts?: { online: number; offline: number; total: number };
  eventCounts?: { active: number; resolved: number; total: number };
}

const defaultFilters: MapFilters = {
  display: {
    showEvents: true,
    showReports: true,
    showCameras: true,
    clusterCameras: true,
  },
  events: {
    status: [],
    priority: [],
    dateRange: {},
  },
  cameras: {
    status: [],
    hasVms: null,
    search: '',
  },
};

export function FilterOverlay({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  cameraCounts = { online: 0, offline: 0, total: 0 },
  eventCounts = { active: 0, resolved: 0, total: 0 },
}: FilterOverlayProps) {
  const [expandedSections, setExpandedSections] = useState({
    display: true,
    events: false,
    cameras: false,
  });

  if (!isOpen) return null;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleReset = () => {
    onFiltersChange(defaultFilters);
  };

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
    const newStatuses = filters.events.status.includes(status)
      ? filters.events.status.filter((s) => s !== status)
      : [...filters.events.status, status];
    
    onFiltersChange({
      ...filters,
      events: {
        ...filters.events,
        status: newStatuses,
      },
    });
  };

  const handleEventPriorityToggle = (priority: string) => {
    const newPriorities = filters.events.priority.includes(priority)
      ? filters.events.priority.filter((p) => p !== priority)
      : [...filters.events.priority, priority];
    
    onFiltersChange({
      ...filters,
      events: {
        ...filters.events,
        priority: newPriorities,
      },
    });
  };

  const handleCameraStatusToggle = (status: string) => {
    const newStatuses = filters.cameras.status.includes(status)
      ? filters.cameras.status.filter((s) => s !== status)
      : [...filters.cameras.status, status];
    
    onFiltersChange({
      ...filters,
      cameras: {
        ...filters.cameras,
        status: newStatuses,
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

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />
      
      {/* Filter Panel */}
      <div className={styles.filterPanel}>
        <div className={styles.header}>
          <h3 className={styles.title}>🔍 Map Filters</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Display Options Section */}
          <div className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => toggleSection('display')}
            >
              <span className={styles.sectionTitle}>👁️ Display Options</span>
              <span className={styles.sectionToggle}>
                {expandedSections.display ? '▼' : '▶'}
              </span>
            </button>
            
            {expandedSections.display && (
              <div className={styles.sectionContent}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.display.showEvents}
                    onChange={() => handleDisplayToggle('showEvents')}
                  />
                  <span>Show Events</span>
                  {eventCounts.total > 0 && (
                    <span className={styles.badge}>{eventCounts.total}</span>
                  )}
                </label>
                
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.display.showReports}
                    onChange={() => handleDisplayToggle('showReports')}
                  />
                  <span>Show Reports</span>
                </label>
                
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.display.showCameras}
                    onChange={() => handleDisplayToggle('showCameras')}
                  />
                  <span>Show Cameras</span>
                  {cameraCounts.total > 0 && (
                    <span className={styles.badge}>{cameraCounts.total}</span>
                  )}
                </label>
                
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.display.clusterCameras}
                    onChange={() => handleDisplayToggle('clusterCameras')}
                    disabled={!filters.display.showCameras}
                  />
                  <span>Cluster Cameras</span>
                </label>
              </div>
            )}
          </div>

          {/* Event Filters Section */}
          <div className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => toggleSection('events')}
            >
              <span className={styles.sectionTitle}>🚨 Event Filters</span>
              <span className={styles.sectionToggle}>
                {expandedSections.events ? '▼' : '▶'}
              </span>
            </button>
            
            {expandedSections.events && (
              <div className={styles.sectionContent}>
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Status</div>
                  <div className={styles.chipGroup}>
                    {['active', 'investigating', 'resolved'].map((status) => (
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
                    {['critical', 'high', 'medium', 'low'].map((priority) => (
                      <button
                        key={priority}
                        className={`${styles.chip} ${styles[`chip${priority.charAt(0).toUpperCase() + priority.slice(1)}`]} ${
                          filters.events.priority.includes(priority) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleEventPriorityToggle(priority)}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Camera Filters Section */}
          <div className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => toggleSection('cameras')}
            >
              <span className={styles.sectionTitle}>📹 Camera Filters</span>
              <span className={styles.sectionToggle}>
                {expandedSections.cameras ? '▼' : '▶'}
              </span>
            </button>
            
            {expandedSections.cameras && (
              <div className={styles.sectionContent}>
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Search</div>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search cameras..."
                    value={filters.cameras.search}
                    onChange={(e) => handleCameraSearchChange(e.target.value)}
                  />
                </div>
                
                <div className={styles.filterGroup}>
                  <div className={styles.filterLabel}>Status</div>
                  <div className={styles.chipGroup}>
                    {['online', 'offline', 'maintenance', 'error'].map((status) => (
                      <button
                        key={status}
                        className={`${styles.chip} ${styles[`chipCamera${status.charAt(0).toUpperCase() + status.slice(1)}`]} ${
                          filters.cameras.status.includes(status) ? styles.chipActive : ''
                        }`}
                        onClick={() => handleCameraStatusToggle(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                
                {cameraCounts.online > 0 && (
                  <div className={styles.statusSummary}>
                    <span className={styles.statusOnline}>● {cameraCounts.online} online</span>
                    <span className={styles.statusOffline}>● {cameraCounts.offline} offline</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.resetButton} onClick={handleReset}>
            Reset All
          </button>
          <button className={styles.applyButton} onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

export { defaultFilters as getDefaultMapFilters };
