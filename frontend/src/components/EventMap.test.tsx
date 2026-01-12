import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventMap } from './EventMap';
import { Event } from '../services/api';

// Mock Leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
  }),
  useMapEvents: () => null,
}));

// Mock Leaflet
vi.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: vi.fn(),
    },
  },
  divIcon: vi.fn(() => ({})),
}));

const mockEvents: Event[] = [
  {
    _id: '1',
    title: 'Test Event',
    description: 'Test description',
    status: 'active',
    priority: 'high',
    eventTypeId: {
      _id: 'type1',
      name: 'Security',
      category: 'security',
      severity: 'high',
      icon: 'shield',
      color: '#FF0000',
      isSystemDefault: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    location: {
      type: 'Point',
      coordinates: [-73.935242, 40.730610],
    },
    locationDescription: 'New York City',
    companyId: 'company1',
    linkedReports: [],
    createdBy: {
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('EventMap', () => {
  it('renders map container', () => {
    render(<EventMap events={mockEvents} />);
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('renders markers for events', () => {
    render(<EventMap events={mockEvents} />);
    
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(mockEvents.length);
  });

  it('renders event details in popup', () => {
    render(<EventMap events={mockEvents} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('New York City')).toBeInTheDocument();
  });

  it('handles empty events array', () => {
    render(<EventMap events={[]} />);
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    const markers = screen.queryAllByTestId('marker');
    expect(markers).toHaveLength(0);
  });
});
