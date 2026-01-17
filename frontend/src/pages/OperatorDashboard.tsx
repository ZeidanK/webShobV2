import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventMap } from '../components/EventMap';
import { api, Event, Report } from '../services/api';
import { useEventCreated, useEventUpdated } from '../hooks/useWebSocket';
import styles from './OperatorDashboard.module.css';

type FilterStatus = 'active' | 'assigned' | 'resolved' | 'all';
type FilterPriority = 'critical' | 'high' | 'medium' | 'low' | 'all';
type DisplayMode = 'events' | 'reports' | 'both';

export function OperatorDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('events');
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>('all');
  
  // Map bounds
  const [mapBounds, setMapBounds] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load events and/or reports from API based on display mode
  const loadEvents = useCallback(async () => {
    if (!mapBounds) return;

    try {
      setLoading(true);
      setError(null);

      const filters: any = {
        ...mapBounds,
      };

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      if (priorityFilter !== 'all') {
        filters.priority = priorityFilter;
      }

      // Fetch based on display mode
      if (displayMode === 'events' || displayMode === 'both') {
        const fetchedEvents = await api.events.getInBounds(filters);
        console.log('[OperatorDashboard] Fetched events:', fetchedEvents?.length || 0);
        setEvents(fetchedEvents || []);
      } else {
        setEvents([]);
      }

      if (displayMode === 'reports' || displayMode === 'both') {
        const reportFilters = { ...mapBounds };
        // Only apply status filter for reports (they don't have priority)
        if (statusFilter !== 'all' && ['pending', 'verified', 'rejected'].includes(statusFilter)) {
          reportFilters.status = statusFilter;
        }
        
        const fetchedReports = await api.reports.getInBounds(reportFilters);
        console.log('[OperatorDashboard] Fetched reports:', fetchedReports?.length || 0);
        setReports(fetchedReports || []);
      } else {
        setReports([]);
      }
    } catch (err: any) {
      console.error('[OperatorDashboard] Failed to load data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [mapBounds, statusFilter, priorityFilter, displayMode]);

  // Load events when filters or bounds change
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle real-time event creation
  useEventCreated((newEvent) => {
    console.log('[OperatorDashboard] New event received:', newEvent);
    
    // Check if event is within current filters
    const matchesStatus = statusFilter === 'all' || newEvent.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || newEvent.priority === priorityFilter;
    
    if (matchesStatus && matchesPriority) {
      setEvents((prev) => [newEvent, ...prev]);
    }
  });

  // Handle real-time event updates
  useEventUpdated((updatedEvent) => {
    console.log('[OperatorDashboard] Event updated:', updatedEvent);
    
    setEvents((prev) =>
      prev.map((event) =>
        event._id === updatedEvent._id ? { ...event, ...updatedEvent } : event
      )
    );
  });

  // Handle map bounds change with debouncing (prevents excessive API calls during zoom/pan)
  const handleBoundsChange = useMemo(() => {
    return (bounds: any) => {
      console.log('[OperatorDashboard] Map bounds changed:', bounds);
      
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer to update bounds after 800ms of inactivity
      debounceTimerRef.current = setTimeout(() => {
        setMapBounds(bounds);
      }, 800);
    };
  }, []);

  // Handle event selection (toggle: clicking again deselects)
  const handleEventClick = useCallback((event: Event) => {
    console.log('[OperatorDashboard] Event clicked:', event._id);
    setSelectedEventId(prev => prev === event._id ? undefined : event._id);
  }, []);

  // Handle event card click (toggle: clicking again deselects)
  const handleEventCardClick = useCallback((event: Event) => {
    setSelectedEventId(prev => prev === event._id ? undefined : event._id);
  }, []);

  // Handle view details
  const handleViewDetails = useCallback((eventId: string) => {
    navigate(`/events/${eventId}`);
  }, [navigate]);

  // Calculate stats
  const stats = {
    total: events.length,
    active: events.filter((e) => e.status === 'active').length,
    high: events.filter((e) => e.priority === 'high').length,
    critical: events.filter((e) => e.priority === 'critical').length,
  };

  // Filter events for list display
  const filteredEvents = events.filter((event) => {
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || event.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get badge class
  const getBadgeClass = (priority: string) => {
    return `${styles.eventCardBadge} ${styles[`eventCardBadge${priority.charAt(0).toUpperCase() + priority.slice(1)}`]}`;
  };

  return (
    <div className={styles.container}>
      {/* Sidebar with event list */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Map Monitor</h2>
          
          {/* Display Mode Toggle */}
          <div className={styles.filters}>
            <button
              className={`${styles.filterButton} ${displayMode === 'events' ? styles.filterButtonActive : ''}`}
              onClick={() => setDisplayMode('events')}
            >
              Events
            </button>
            <button
              className={`${styles.filterButton} ${displayMode === 'reports' ? styles.filterButtonActive : ''}`}
              onClick={() => setDisplayMode('reports')}
            >
              Reports
            </button>
            <button
              className={`${styles.filterButton} ${displayMode === 'both' ? styles.filterButtonActive : ''}`}
              onClick={() => setDisplayMode('both')}
            >
              Both
            </button>
          </div>
          
          {/* Status Filters */}
          <div className={styles.filters}>
            <button
              className={`${styles.filterButton} ${statusFilter === 'all' ? styles.filterButtonActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`${styles.filterButton} ${statusFilter === 'active' ? styles.filterButtonActive : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`${styles.filterButton} ${statusFilter === 'assigned' ? styles.filterButtonActive : ''}`}
              onClick={() => setStatusFilter('assigned')}
            >
              Assigned
            </button>
            <button
              className={`${styles.filterButton} ${statusFilter === 'resolved' ? styles.filterButtonActive : ''}`}
              onClick={() => setStatusFilter('resolved')}
            >
              Resolved
            </button>
          </div>

          {/* Priority Filters */}
          <div className={styles.filters} style={{ marginTop: '8px' }}>
            <button
              className={`${styles.filterButton} ${priorityFilter === 'all' ? styles.filterButtonActive : ''}`}
              onClick={() => setPriorityFilter('all')}
            >
              All Priority
            </button>
            <button
              className={`${styles.filterButton} ${priorityFilter === 'critical' ? styles.filterButtonActive : ''}`}
              onClick={() => setPriorityFilter('critical')}
            >
              Critical
            </button>
            <button
              className={`${styles.filterButton} ${priorityFilter === 'high' ? styles.filterButtonActive : ''}`}
              onClick={() => setPriorityFilter('high')}
            >
              High
            </button>
          </div>

          {/* Stats */}
          <div className={styles.stats}>
            <div className={`${styles.statBadge} ${styles.statBadgeActive}`}>
              📊 {stats.total} Total
            </div>
            <div className={`${styles.statBadge} ${styles.statBadgeActive}`}>
              🔴 {stats.active} Active
            </div>
            <div className={`${styles.statBadge} ${styles.statBadgeHigh}`}>
              ⚡ {stats.high} High
            </div>
            <div className={`${styles.statBadge} ${styles.statBadgeCritical}`}>
              ⚠️ {stats.critical} Critical
            </div>
          </div>
        </div>

        {/* Event List */}
        <div className={styles.eventList}>
          {error && <div className={styles.error}>{error}</div>}
          
          {loading && <div className={styles.loading}>Loading events...</div>}
          
          {!loading && filteredEvents.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📍</div>
              <h3 className={styles.emptyTitle}>No events found</h3>
              <p className={styles.emptyText}>
                Move the map or adjust filters to view events
              </p>
            </div>
          )}

          {!loading && filteredEvents.map((event) => (
            <div
              key={event._id}
              className={`${styles.eventCard} ${event._id === selectedEventId ? styles.eventCardSelected : ''}`}
              onClick={() => handleEventCardClick(event)}
              onDoubleClick={() => handleViewDetails(event._id)}
            >
              <div className={styles.eventCardHeader}>
                <h3 className={styles.eventCardTitle}>{event.title}</h3>
                <span className={getBadgeClass(event.priority)}>
                  {event.priority}
                </span>
              </div>

              {event.description && (
                <p className={styles.eventCardDescription}>{event.description}</p>
              )}

              <div className={styles.eventCardMeta}>
                <span className={styles.eventCardMetaItem}>
                  📍 {event.locationDescription || 'Location'}
                </span>
                <span className={styles.eventCardMetaItem}>
                  ⏰ {formatDate(event.createdAt)}
                </span>
                <span className={styles.eventCardMetaItem}>
                  📊 {event.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className={styles.mapContainer}>
        <EventMap
          events={filteredEvents}
          reports={reports}
          onBoundsChange={handleBoundsChange}
          onEventClick={handleEventClick}
          selectedEventId={selectedEventId}
          center={[31.5, 34.8]} // Israel default
          zoom={8}
        />
      </div>
    </div>
  );
}
