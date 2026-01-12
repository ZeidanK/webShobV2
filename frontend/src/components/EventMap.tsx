import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L, { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Event, Report } from '../services/api';
import styles from './EventMap.module.css';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface EventMapProps {
  events: Event[];
  reports?: Report[];
  onBoundsChange?: (bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }) => void;
  onEventClick?: (event: Event) => void;
  onReportClick?: (report: Report) => void;
  selectedEventId?: string;
  center?: [number, number];
  zoom?: number;
}

// Shared ref to track programmatic map movements
const isProgrammaticMoveRef = { current: false };

// Component to handle map events
function MapEventHandler({ onBoundsChange }: { onBoundsChange?: (bounds: any) => void }) {
  const map = useMapEvents({
    moveend: () => {
      // Skip bounds change callback if this is a programmatic move (e.g., clicking an event marker)
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }
      
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          minLng: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLng: bounds.getEast(),
          maxLat: bounds.getNorth(),
        });
      }
    },
  });

  return null;
}

// Component to update map view when selectedEventId changes
function MapViewController({ selectedEventId, events }: { selectedEventId?: string; events: Event[] }) {
  const map = useMap();
  const prevSelectedIdRef = useRef<string | undefined>();

  useEffect(() => {
    // Only center map if selectedEventId actually changed (not when events array updates)
    if (selectedEventId && selectedEventId !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedEventId;
      const event = events.find(e => e._id === selectedEventId);
      if (event && event.location) {
        // Mark as programmatic move to prevent triggering bounds change callback
        isProgrammaticMoveRef.current = true;
        map.setView([event.location.coordinates[1], event.location.coordinates[0]], 16, {
          animate: true,
        });
      }
    } else if (!selectedEventId) {
      prevSelectedIdRef.current = undefined;
    }
  }, [selectedEventId, events, map]);

  return null;
}

// Get marker icon based on priority (for Events)
function getMarkerIcon(priority: string, isSelected: boolean): DivIcon {
  const size = isSelected ? 32 : 24;
  const className = `${styles.marker} ${styles[`marker${priority.charAt(0).toUpperCase() + priority.slice(1)}`]}`;

  return new L.DivIcon({
    className,
    html: `<div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${size - 10}px;">
      ${priority === 'critical' ? '⚠' : priority === 'high' ? '!' : priority === 'medium' ? '●' : '○'}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Get marker icon based on status (for Reports)
function getReportMarkerIcon(status: string): DivIcon {
  const size = 24;
  const colors: Record<string, string> = {
    pending: '#ffa500',    // Orange
    verified: '#28a745',   // Green
    rejected: '#6c757d',   // Gray
  };
  const color = colors[status] || '#6c757d';

  return new L.DivIcon({
    className: styles.marker,
    html: `<div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-size: ${size - 8}px; background-color: ${color}; border-radius: 50%; color: white; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
      📝
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Get badge class based on priority
function getBadgeClass(priority: string): string {
  return `${styles.popupBadge} ${styles[`popupBadge${priority.charAt(0).toUpperCase() + priority.slice(1)}`]}`;
}

// Format date
function formatDate(dateString: string): string {
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
}

export function EventMap({
  events,
  reports = [],
  onBoundsChange,
  onEventClick,
  onReportClick,
  selectedEventId,
  center = [31.5, 34.8], // Default to Israel
  zoom = 8,
}: EventMapProps) {
  const [mapReady, setMapReady] = useState(false);

  return (
    <div className={styles.mapContainer}>
      <MapContainer
        center={center}
        zoom={zoom}
        className={styles.map}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {mapReady && (
          <>
            <MapEventHandler onBoundsChange={onBoundsChange} />
            <MapViewController selectedEventId={selectedEventId} events={events} />
            
            {/* Render Event markers */}
            {events.map((event) => {
              if (!event.location?.coordinates) return null;

              const position: [number, number] = [
                event.location.coordinates[1],
                event.location.coordinates[0],
              ];

              const isSelected = event._id === selectedEventId;

              return (
                <Marker
                  key={`event-${event._id}`}
                  position={position}
                  icon={getMarkerIcon(event.priority, isSelected)}
                  eventHandlers={{
                    click: () => onEventClick?.(event),
                  }}
                >
                  <Popup>
                    <div className={styles.popupContainer}>
                      <div className={styles.popupHeader}>
                        <h3 className={styles.popupTitle}>{event.title}</h3>
                        <span className={getBadgeClass(event.priority)}>
                          {event.priority}
                        </span>
                      </div>

                      {event.description && (
                        <p className={styles.popupDescription}>{event.description}</p>
                      )}

                      <div className={styles.popupMeta}>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>📍</span>
                          <span>{event.locationDescription || 'Location not specified'}</span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>🏷️</span>
                          <span>
                            {typeof event.eventTypeId === 'object' 
                              ? event.eventTypeId.name 
                              : 'Unknown Type'}
                          </span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>⏰</span>
                          <span>{formatDate(event.createdAt)}</span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>📊</span>
                          <span>Status: {event.status}</span>
                        </div>
                        {event.linkedReports && Array.isArray(event.linkedReports) && (
                          <div className={styles.popupMetaItem}>
                            <span className={styles.popupMetaIcon}>📝</span>
                            <span>{event.linkedReports.length} linked report(s)</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.popupActions}>
                        <button
                          className={`${styles.popupButton} ${styles.popupButtonPrimary}`}
                          onClick={() => window.location.href = `/events/${event._id}`}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Render Report markers */}
            {reports.map((report) => {
              if (!report.location?.coordinates) return null;

              const position: [number, number] = [
                report.location.coordinates[1],
                report.location.coordinates[0],
              ];

              return (
                <Marker
                  key={`report-${report._id}`}
                  position={position}
                  icon={getReportMarkerIcon(report.status)}
                  eventHandlers={{
                    click: () => onReportClick?.(report),
                  }}
                >
                  <Popup>
                    <div className={styles.popupContainer}>
                      <div className={styles.popupHeader}>
                        <h3 className={styles.popupTitle}>📝 {report.title}</h3>
                        <span className={`${styles.popupBadge} ${styles[`popupBadge${report.status.charAt(0).toUpperCase() + report.status.slice(1)}`]}`}>
                          {report.status}
                        </span>
                      </div>

                      {report.description && (
                        <p className={styles.popupDescription}>{report.description}</p>
                      )}

                      <div className={styles.popupMeta}>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>📍</span>
                          <span>{report.locationDescription || 'Location not specified'}</span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>🏷️</span>
                          <span>{report.type}</span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>⏰</span>
                          <span>{formatDate(report.createdAt)}</span>
                        </div>
                        <div className={styles.popupMetaItem}>
                          <span className={styles.popupMetaIcon}>👤</span>
                          <span>
                            {typeof report.reportedBy === 'object' 
                              ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}`
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.popupActions}>
                        <button
                          className={`${styles.popupButton} ${styles.popupButtonPrimary}`}
                          onClick={() => window.location.href = `/reports/${report._id}`}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </>
        )}
      </MapContainer>
    </div>
  );
}
