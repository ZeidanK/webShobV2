import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Event } from '../services/api';
import { websocketService, WebSocketEvent } from '../services/websocket';
import { getCurrentUser } from '../utils/auth';
import styles from './SuperAdminEventsPage.module.css';

interface Company {
  _id: string;
  name: string;
  type: string;
  status: string;
}

export default function SuperAdminEventsPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  
  // Check if user is super_admin
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'super_admin') {
      navigate('/events');
    }
  }, [currentUser, navigate]);

  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  // Load companies for filter
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await api.companies.list({ pageSize: 1000 });
        setCompanies(response.data);
      } catch (err: any) {
        console.error('[SuperAdminEventsPage] Error loading companies:', err);
      }
    };
    
    loadCompanies();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: Record<string, any> = {
        page: currentPage,
        pageSize,
      };
      
      if (companyFilter) params.companyId = companyFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (searchQuery) params.search = searchQuery;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const response = await api.events.list(params);
      setEvents(response.events);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
      console.error('[SuperAdminEventsPage] Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentPage, companyFilter, statusFilter, priorityFilter, searchQuery, startDate, endDate]);

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribeCreated = websocketService.on(WebSocketEvent.EVENT_CREATED, (data: Event) => {
      console.log('[SuperAdminEventsPage] Event created via WebSocket:', data);
      setEvents(prev => [data, ...prev]);
      setTotal(prev => prev + 1);
    });

    const unsubscribeUpdated = websocketService.on(WebSocketEvent.EVENT_UPDATED, (data: Event) => {
      console.log('[SuperAdminEventsPage] Event updated via WebSocket:', data);
      setEvents(prev => prev.map(event => event._id === data._id ? data : event));
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c._id === companyId);
    return company ? company.name : 'Unknown Company';
  };

  return (
    <div className={styles.eventsPage}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>All Events (Super Admin)</h1>
          <p className={styles.subtitle}>Cross-company event monitoring and management</p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Company</label>
          <select 
            value={companyFilter} 
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Companies</option>
            {companies.map(company => (
              <option key={company._id} value={company._id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Status</label>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="assigned">Assigned</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Priority</label>
          <select 
            value={priorityFilter} 
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Search</label>
          <input 
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Start Date</label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>End Date</label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading events...</div>
      ) : events.length === 0 ? (
        <div className={styles.empty}>
          <p>No events found</p>
          <p className={styles.emptySubtext}>
            {companyFilter || statusFilter || priorityFilter || searchQuery || startDate || endDate
              ? 'Try adjusting your filters'
              : 'No events have been created yet'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.eventsList}>
            {events.map(event => (
              <div 
                key={event._id}
                className={styles.eventCard}
                onClick={() => navigate(`/events/${event._id}`)}
              >
                <div className={styles.eventHeader}>
                  <div>
                    <h3 className={styles.eventTitle}>{event.title}</h3>
                    {event.description && (
                      <p className={styles.eventDescription}>{event.description}</p>
                    )}
                  </div>
                  <div className={styles.eventMeta}>
                    <span className={`${styles.statusBadge} ${getStatusClass(event.status)}`}>
                      {event.status}
                    </span>
                    <span className={`${styles.priorityBadge} ${getPriorityClass(event.priority)}`}>
                      {event.priority}
                    </span>
                  </div>
                </div>
                
                <div className={styles.eventDetails}>
                  <div className={styles.detail}>
                    <strong>Company:</strong> {getCompanyName(event.companyId)}
                  </div>
                  <div className={styles.detail}>
                    <strong>Created:</strong> {formatDate(event.createdAt)}
                  </div>
                  {event.locationDescription && (
                    <div className={styles.detail}>
                      <strong>Location:</strong> {event.locationDescription}
                    </div>
                  )}
                  {event.assignedTo && (
                    <div className={styles.detail}>
                      <strong>Assigned to:</strong> {event.assignedTo.firstName} {event.assignedTo.lastName}
                    </div>
                  )}
                  <div className={styles.detail}>
                    <strong>Reports:</strong> {event.linkedReports?.length || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`${styles.pageButton} ${page === currentPage ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              
              <button
                className={styles.pageButton}
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Showing {events.length} of {total} events
          </div>
        </>
      )}
    </div>
  );
}
