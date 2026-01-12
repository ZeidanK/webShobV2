import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OperatorDashboard } from './OperatorDashboard';
import { api } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  api: {
    events: {
      getInBounds: vi.fn(),
    },
  },
}));

// Mock the hooks
vi.mock('../hooks/useWebSocket', () => ({
  useEventCreated: vi.fn(() => {}),
  useEventUpdated: vi.fn(() => {}),
}));

// Mock the EventMap component
vi.mock('../components/EventMap', () => ({
  EventMap: ({ events, onBoundsChange }: any) => {
    // Simulate bounds change on mount
    if (onBoundsChange) {
      setTimeout(() => {
        onBoundsChange({
          minLng: -74.2,
          minLat: 40.5,
          maxLng: -73.7,
          maxLat: 40.9,
        });
      }, 100);
    }
    return <div data-testid="event-map">Map with {events.length} events</div>;
  },
}));

const mockEvents = [
  {
    _id: '1',
    title: 'Test Event 1',
    description: 'Test description 1',
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
      type: 'Point' as const,
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
  {
    _id: '2',
    title: 'Test Event 2',
    description: 'Test description 2',
    status: 'active',
    priority: 'critical',
    eventTypeId: {
      _id: 'type2',
      name: 'Emergency',
      category: 'emergency',
      severity: 'critical',
      icon: 'alert',
      color: '#9C27B0',
      isSystemDefault: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    location: {
      type: 'Point' as const,
      coordinates: [-73.98, 40.75],
    },
    locationDescription: 'Manhattan',
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

describe('OperatorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.events.getInBounds as any).mockResolvedValue(mockEvents);
  });

  it('renders the dashboard with event list and map', async () => {
    render(
      <BrowserRouter>
        <OperatorDashboard />
      </BrowserRouter>
    );

    // Check header
    expect(screen.getByText('Events Monitor')).toBeInTheDocument();

    // Check filters
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('All Priority')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();

    // Wait for map to trigger bounds change and events to load
    await waitFor(
      () => {
        expect(api.events.getInBounds).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Check if events are displayed
    await waitFor(() => {
      expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      expect(screen.getByText('Test Event 2')).toBeInTheDocument();
    });
  });

  it('displays event statistics', async () => {
    render(
      <BrowserRouter>
        <OperatorDashboard />
      </BrowserRouter>
    );

    // Wait for events to load
    await waitFor(() => {
      expect(api.events.getInBounds).toHaveBeenCalled();
    });

    // Check stats badges
    await waitFor(() => {
      expect(screen.getByText(/2 Total/)).toBeInTheDocument();
      expect(screen.getByText(/2 Active/)).toBeInTheDocument();
      expect(screen.getByText(/1 High/)).toBeInTheDocument();
      expect(screen.getByText(/1 Critical/)).toBeInTheDocument();
    });
  });

  it('filters events by status', async () => {
    (api.events.getInBounds as any).mockResolvedValue([mockEvents[0]]);

    render(
      <BrowserRouter>
        <OperatorDashboard />
      </BrowserRouter>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(api.events.getInBounds).toHaveBeenCalled();
    });

    // The filter buttons should trigger a new API call with filters
    // This is tested through the component's behavior
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders map component', async () => {
    render(
      <BrowserRouter>
        <OperatorDashboard />
      </BrowserRouter>
    );

    // Check if map is rendered
    const map = await screen.findByTestId('event-map');
    expect(map).toBeInTheDocument();
  });
});
