/**
 * API Client for Event Monitoring Platform
 * Handles all HTTP requests to the backend API with:
 * - Automatic token injection
 * - Correlation ID propagation
 * - Standard error handling
 * - Response envelope unwrapping
 */

import { logFrontendIssue } from './testLogger';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

// Report types for Slice 3
export interface ReportLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ReportAttachment {
  _id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface Report {
  _id: string;
  title: string;
  description: string;
  type: string;
  source: string;
  status: 'pending' | 'verified' | 'rejected';
  companyId: string;
  location: ReportLocation;
  locationDescription?: string;
  reportedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reporterName?: string;
  attachments: ReportAttachment[];
  verifiedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  verifiedAt?: string;
  rejectionReason?: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

// Event types for Slice 4
export interface EventType {
  _id: string;
  name: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
  color: string;
  isSystemDefault: boolean;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  _id: string;
  title: string;
  description?: string;
  status: 'active' | 'assigned' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  eventTypeId: EventType | string;
  location: ReportLocation;
  locationDescription?: string;
  companyId: string;
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedAt?: string;
  resolvedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  resolvedAt?: string;
  closedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  closedAt?: string;
  linkedReports: Array<Report | string>;
  notes?: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  eventTypeId: string;
  location: {
    longitude: number;
    latitude: number;
  };
  locationDescription?: string;
  notes?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  eventTypeId?: string;
  locationDescription?: string;
  notes?: string;
}

// VMS types for Slice 9.0
export type VmsProvider = 'shinobi' | 'zoneminder' | 'agentdvr' | 'other';

export interface VmsServer {
  _id: string;
  companyId: string;
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  // Public base URL for browser stream access (optional).
  publicBaseUrl?: string;
  isActive: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'unknown';
  lastConnectedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VmsMonitor {
  id: string;
  name: string;
  mode?: string;
  status?: string;
  host?: string;
  type?: string;
}

export interface CreateVmsServerInput {
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  // Public base URL for browser stream access (optional).
  publicBaseUrl?: string;
  auth?: {
    apiKey?: string;
    groupKey?: string;
    username?: string;
    password?: string;
  };
  isActive?: boolean;
}

export interface UpdateVmsServerInput {
  name?: string;
  baseUrl?: string;
  // Public base URL for browser stream access (optional).
  publicBaseUrl?: string;
  auth?: {
    apiKey?: string;
    groupKey?: string;
    username?: string;
    password?: string;
  };
  isActive?: boolean;
}

// Camera types for Slice 9.0
export type CameraType = 'ip' | 'analog' | 'usb';
export type CameraStatus = 'online' | 'offline' | 'error' | 'maintenance';
// TEST-ONLY: Stream configuration types for Phase 2 scaffolding.
export type StreamConfigType = 'vms' | 'direct-rtsp';

// TEST-ONLY: Camera capability flags.
export interface CameraCapabilities {
  ptz?: boolean;
  audio?: boolean;
  motionDetection?: boolean;
}

// TEST-ONLY: Maintenance schedule metadata.
export interface CameraMaintenanceSchedule {
  intervalDays?: number;
  lastServiceAt?: string;
  nextServiceAt?: string;
  notes?: string;
}

// TEST-ONLY: Stream configuration payload for Direct RTSP.
export interface StreamConfig {
  type: StreamConfigType;
  rtspUrl?: string;
  transport?: 'tcp' | 'udp';
  auth?: {
    username?: string;
    password?: string;
  };
}

export interface Camera {
  _id: string;
  companyId: string;
  name: string;
  description?: string;
  streamUrl?: string;
  streamConfig?: StreamConfig;
  type: CameraType;
  status: CameraStatus;
  // TEST-ONLY: Optional capability flags.
  capabilities?: CameraCapabilities;
  // TEST-ONLY: Maintenance schedule tracking.
  maintenanceSchedule?: CameraMaintenanceSchedule;
  // TEST-ONLY: Tag list for categorization.
  tags?: string[];
  location: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
  };
  settings: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  vms?: {
    provider?: VmsProvider;
    serverId?: string;
    monitorId?: string;
    lastSyncAt?: string;
  };
  metadata?: {
    source?: string;
    externalId?: string;
    tags?: string[];
  };
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamUrls {
  hls?: string;
  embed?: string;
  snapshot?: string;
  raw?: string;
}

// TEST-ONLY: Camera audit log shape.
export interface CameraAuditLog {
  _id: string;
  action: string;
  companyId: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  timestamp: string;
}

export interface CameraWithStreams extends Camera {
  streams?: StreamUrls;
}

export interface CreateCameraInput {
  name: string;
  description?: string;
  streamUrl?: string;
  streamConfig?: StreamConfig;
  type?: CameraType;
  status?: CameraStatus;
  capabilities?: CameraCapabilities;
  maintenanceSchedule?: CameraMaintenanceSchedule;
  tags?: string[];
  location: {
    coordinates: [number, number];
    address?: string;
  };
  settings?: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  vms?: {
    serverId?: string;
    monitorId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface UpdateCameraInput {
  name?: string;
  description?: string;
  streamUrl?: string;
  streamConfig?: StreamConfig;
  type?: CameraType;
  status?: CameraStatus;
  capabilities?: CameraCapabilities;
  maintenanceSchedule?: CameraMaintenanceSchedule;
  tags?: string[];
  location?: {
    coordinates?: [number, number];
    address?: string;
  };
  settings?: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  metadata?: Record<string, unknown>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Refresh the access token using the stored refresh token.
  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as ApiResponse<{ accessToken: string }>;
    const accessToken = data?.data?.accessToken;
    if (!accessToken) {
      return null;
    }

    localStorage.setItem('accessToken', accessToken);
    return accessToken;
  }

  // Execute a request and retry once after refreshing the access token.
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    params?: Record<string, string | number>,
    body?: string,
    retried = false
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        // TEST-ONLY: Skip undefined/empty query params to avoid invalid ObjectId casts.
        if (value === undefined || value === null || value === '') {
          return;
        }
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: this.getHeaders(),
      body,
    });

    if (response.status === 401 && !retried) {
      const errorData = await response.clone().json().catch(() => null);
      const code = (errorData as ApiError | null)?.error?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'INVALID_TOKEN') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.request(method, path, params, body, true);
        }
      }
    }

    return response;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    const token = localStorage.getItem('accessToken');
    console.log('[API] Token present:', !!token, token ? `(${token.substring(0, 20)}...)` : '');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      // Test logger capture for failed API calls
      logFrontendIssue({
        level: 'error',
        event: 'api.request.failed',
        message: error.error?.message || 'Request failed',
        data: { status: response.status, code: error.error?.code },
      });
      throw new ApiRequestError(
        error.error?.message || 'Request failed',
        error.error?.code || 'UNKNOWN_ERROR',
        response.status,
        error.correlationId
      );
    }

    // Unwrap response envelope
    const apiResponse = data as ApiResponse<T>;
    return apiResponse.data;
  }

  private async handlePaginatedResponse<T>(response: Response): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      // Test logger capture for failed paginated API calls
      logFrontendIssue({
        level: 'error',
        event: 'api.request.failed',
        message: error.error?.message || 'Request failed',
        data: { status: response.status, code: error.error?.code },
      });
      throw new ApiRequestError(
        error.error?.message || 'Request failed',
        error.error?.code || 'UNKNOWN_ERROR',
        response.status,
        error.correlationId
      );
    }

    // Return both data and meta for paginated responses
    const apiResponse = data as ApiResponse<T>;
    return { data: apiResponse.data, meta: apiResponse.meta };
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const response = await this.request('GET', path, params);

    return this.handleResponse<T>(response);
  }

  async getPaginated<T>(path: string, params?: Record<string, string | number>): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
    const response = await this.request('GET', path, params);

    return this.handlePaginatedResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const payload = body ? JSON.stringify(body) : undefined;
    const response = await this.request('POST', path, undefined, payload);

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body);
    const response = await this.request('PUT', path, undefined, payload);

    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body);
    const response = await this.request('PATCH', path, undefined, payload);

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await this.request('DELETE', path);

    return this.handleResponse<T>(response);
  }

  async uploadFiles<T>(path: string, formData: FormData): Promise<T> {
    // Don't set Content-Type for FormData - browser will set it with boundary
    const headers: Record<string, string> = {};

    // Add auth token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  correlationId?: string;

  constructor(message: string, code: string, status: number, correlationId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.correlationId = correlationId;
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export typed API methods (to be expanded per slice)
export const api = {
  // Health check
  health: () => apiClient.get<{ status: string; timestamp: string }>('/health'),

  // Auth (Slice 1)
  auth: {
    register: (email: string, password: string, firstName: string, lastName: string) =>
      apiClient.post<{ accessToken: string; refreshToken: string; user: unknown }>('/auth/register', {
        email,
        password,
        firstName,
        lastName,
      }),
    login: (email: string, password: string) =>
      apiClient.post<{ accessToken: string; refreshToken: string; user: unknown }>('/auth/login', {
        email,
        password,
      }),
    logout: () => apiClient.post('/auth/logout'),
    refresh: (refreshToken: string) =>
      apiClient.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
  },

  // Users (Slice 2)
  users: {
    list: async (params?: {
      page?: number;
      pageSize?: number;
      role?: string;
      isActive?: boolean;
      search?: string;
    }): Promise<{
      users: Array<{
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        isActive: boolean;
        companyId: string;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }> => {
      const response = await apiClient.getPaginated<Array<{
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        isActive: boolean;
        companyId: string;
        createdAt: string;
        updatedAt: string;
      }>>('/users', params as Record<string, string | number>);
      
      return {
        users: response.data || [],
        pagination: {
          total: response.meta?.total || 0,
          page: response.meta?.page || 1,
          pageSize: response.meta?.pageSize || 20,
          totalPages: response.meta?.totalPages || 1,
        },
      };
    },
    get: (id: string) => apiClient.get<{
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
      companyId: string;
      createdAt: string;
      updatedAt: string;
    }>(`/users/${id}`),
    create: (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
    }) => apiClient.post<{
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
      companyId: string;
    }>('/users', data),
    update: (id: string, data: {
      firstName?: string;
      lastName?: string;
      role?: string;
      isActive?: boolean;
    }) => apiClient.patch<{
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
      companyId: string;
    }>(`/users/${id}`, data),
    delete: (id: string) => apiClient.delete<{
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
      companyId: string;
    }>(`/users/${id}`),
  },

  // Companies (Slice 2)
  companies: {
    list: (params?: { page?: number; pageSize?: number; status?: string; }) => 
      apiClient.getPaginated<{
        _id: string;
        name: string;
        type: string;
        status: string;
      }[]>('/companies', params),
    
    get: (id: string) => apiClient.get<{
      _id: string;
      name: string;
      type: string;
      status: string;
      settings: {
        allowCitizenReports: boolean;
        autoLinkReportsToEvents: boolean;
        maxUsers: number;
        features: string[];
      };
      createdAt: string;
      updatedAt: string;
    }>(`/companies/${id}`),
    updateSettings: (id: string, settings: {
      allowCitizenReports?: boolean;
      autoLinkReportsToEvents?: boolean;
      maxUsers?: number;
      features?: string[];
    }) => apiClient.patch<{
      _id: string;
      name: string;
      type: string;
      status: string;
      settings: {
        allowCitizenReports: boolean;
        autoLinkReportsToEvents: boolean;
        maxUsers: number;
        features: string[];
      };
    }>(`/companies/${id}/settings`, settings),
    regenerateApiKey: (id: string) => apiClient.post<{ apiKey: string }>(`/companies/${id}/regenerate-api-key`),
  },

  // Reports (Slice 3)
  reports: {
    list: (params?: { 
      page?: number; 
      pageSize?: number; 
      status?: string;
      type?: string;
      reportedBy?: string;
      startDate?: string;
      endDate?: string;
    }) => apiClient.getPaginated<Report[]>('/reports', params),
    
    get: (id: string) => apiClient.get<Report>(`/reports/${id}`),
    
    create: (data: {
      title: string;
      description: string;
      type: string;
      location: {
        longitude: number;
        latitude: number;
      };
      locationDescription?: string;
    }) => {
      // Transform location to GeoJSON format expected by backend
      const payload = {
        ...data,
        location: {
          type: 'Point' as const,
          coordinates: [data.location.longitude, data.location.latitude],
        },
      };
      return apiClient.post<Report>('/reports', payload);
    },
    
    addAttachments: (id: string, files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      
      return apiClient.uploadFiles<Report>(`/reports/${id}/attachments`, formData);
    },
    
    verify: (id: string) => apiClient.patch<Report>(`/reports/${id}/verify`, {}),
    
    reject: (id: string, rejectionReason: string) => 
      apiClient.patch<Report>(`/reports/${id}/reject`, { rejectionReason }),

    // Get reports within geographic bounds
    getInBounds: (params: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
      status?: string | string[];
      type?: string | string[];
    }) => {
      const queryParams: Record<string, string> = {
        minLng: params.minLng.toString(),
        minLat: params.minLat.toString(),
        maxLng: params.maxLng.toString(),
        maxLat: params.maxLat.toString(),
      };

      // Handle array filters
      if (params.status) {
        if (Array.isArray(params.status)) {
          // For arrays, we need to add multiple query params with the same key
          params.status.forEach((s, index) => {
            queryParams[`status[${index}]`] = s;
          });
        } else {
          queryParams.status = params.status;
        }
      }

      if (params.type) {
        if (Array.isArray(params.type)) {
          // For arrays, we need to add multiple query params with the same key
          params.type.forEach((t, index) => {
            queryParams[`type[${index}]`] = t;
          });
        } else {
          queryParams.type = params.type;
        }
      }

      return apiClient.get<Report[]>('/reports/geo', queryParams);
    },
  },

  // Events (Slice 4)
  events: {
    list: async (params?: { 
      page?: number; 
      pageSize?: number; 
      status?: string;
      priority?: string;
      eventTypeId?: string;
      assignedTo?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    }): Promise<{
      events: Event[];
      pagination: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }> => {
      const response = await apiClient.getPaginated<Event[]>('/events', params as Record<string, string | number>);
      
      return {
        events: response.data || [],
        pagination: {
          total: response.meta?.total || 0,
          page: response.meta?.page || 1,
          pageSize: response.meta?.pageSize || 20,
          totalPages: response.meta?.totalPages || 1,
        },
      };
    },

    get: (id: string) => apiClient.get<Event>(`/events/${id}`),

    create: (data: CreateEventInput) => {
      // Transform location to GeoJSON format expected by backend
      const payload = {
        ...data,
        location: {
          type: 'Point' as const,
          coordinates: [data.location.longitude, data.location.latitude],
        },
      };
      return apiClient.post<Event>('/events', payload);
    },

    update: (id: string, data: UpdateEventInput) => apiClient.patch<Event>(`/events/${id}`, data),

    updateStatus: (id: string, status: 'active' | 'assigned' | 'resolved' | 'closed', notes?: string) =>
      apiClient.patch<Event>(`/events/${id}/status`, { status, notes }),

    linkReport: (eventId: string, reportId: string) =>
      apiClient.post<Event>(`/events/${eventId}/reports`, { reportId }),

    unlinkReport: (eventId: string, reportId: string) =>
      apiClient.delete<Event>(`/events/${eventId}/reports/${reportId}`),

    // Geo query for map views (Slice 6)
    getInBounds: (bounds: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
      status?: string | string[];
      priority?: string | string[];
      eventTypeId?: string;
    }) => {
      const params: Record<string, string | number> = {
        minLng: bounds.minLng,
        minLat: bounds.minLat,
        maxLng: bounds.maxLng,
        maxLat: bounds.maxLat,
      };

      if (bounds.status) {
        if (Array.isArray(bounds.status)) {
          bounds.status.forEach(s => params[`status`] = s);
        } else {
          params.status = bounds.status;
        }
      }

      if (bounds.priority) {
        if (Array.isArray(bounds.priority)) {
          bounds.priority.forEach(p => params[`priority`] = p);
        } else {
          params.priority = bounds.priority;
        }
      }

      if (bounds.eventTypeId) {
        params.eventTypeId = bounds.eventTypeId;
      }

      return apiClient.get<Event[]>('/events/geo', params);
    },
  },

  // Event Types (Slice 4)
  eventTypes: {
    list: (params?: { category?: string; severity?: string }) =>
      apiClient.get<EventType[]>('/event-types', params),

    get: (id: string) => apiClient.get<EventType>(`/event-types/${id}`),

    create: (data: {
      name: string;
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      icon: string;
      color: string;
    }) => apiClient.post<EventType>('/event-types', data),
  },

  // Cameras (Slice 9.0)
  cameras: {
    list: (params?: { 
      page?: number; 
      limit?: number; 
      status?: CameraStatus;
      vmsServerId?: string;
      hasVms?: boolean;
      search?: string;
      tags?: string[];
    }) => {
      const query: Record<string, string | number> = { ...(params as Record<string, string | number>) };
      if (params?.tags && params.tags.length > 0) {
        // TEST-ONLY: Send tags as a comma-delimited query string.
        query.tags = params.tags.join(',');
      }
      return apiClient.get<Camera[]>('/cameras', query);
    },

    get: (id: string, includeStreams?: boolean) => 
      apiClient.get<CameraWithStreams>(`/cameras/${id}`, includeStreams ? { includeStreams: 'true' } : undefined),

    create: (data: CreateCameraInput) => 
      apiClient.post<Camera>('/cameras', data),

    update: (id: string, data: UpdateCameraInput) => 
      apiClient.put<Camera>(`/cameras/${id}`, data),

    delete: (id: string) => 
      apiClient.delete<{ message: string }>(`/cameras/${id}`),

    getStreams: (id: string) => 
      apiClient.get<StreamUrls>(`/cameras/${id}/streams`),

    getLogs: (id: string, limit?: number) =>
      apiClient.get<CameraAuditLog[]>(`/cameras/${id}/logs`, limit ? { limit } : undefined),

    // TEST-ONLY: Unified RTSP/VMS connectivity test endpoint.
    testConnection: (data: {
      mode?: 'rtsp' | 'vms';
      rtspUrl?: string;
      transport?: 'tcp' | 'udp';
      serverId?: string;
    }) => apiClient.post<{ success: boolean; message: string; monitors?: number }>(
      '/cameras/test-connection',
      data
    ),

    connectToVms: (id: string, serverId: string, monitorId: string) =>
      apiClient.post<Camera>(`/cameras/${id}/vms/connect`, { serverId, monitorId }),

    disconnectFromVms: (id: string) =>
      apiClient.post<Camera>(`/cameras/${id}/vms/disconnect`),

    batchImportFromVms: (serverId: string, monitors: Array<{
      monitorId: string;
      name: string;
      location: { coordinates: [number, number]; address?: string };
    }>) => apiClient.post<{ created: number; skipped: number; cameras: Camera[] }>('/cameras/vms/import', { 
      serverId, 
      monitors 
    }),

    getAvailableMonitors: (serverId: string) =>
      apiClient.get<VmsMonitor[]>('/cameras/vms/available', { serverId }),

    // Optional limit supports nearby camera wall sizing.
    findNearby: (lng: number, lat: number, maxDistance?: number, limit?: number) =>
      apiClient.get<Camera[]>('/cameras/nearby', { 
        lng, 
        lat, 
        ...(maxDistance ? { maxDistance } : {}),
        ...(limit ? { limit } : {}),
      }),

    listByStatus: (status: CameraStatus) =>
      apiClient.get<Camera[]>(`/cameras/status/${status}`),

    listByTag: (tag: string) =>
      apiClient.get<Camera[]>(`/cameras/tags/${encodeURIComponent(tag)}`),

    refreshStatus: (companyId?: string) =>
      apiClient.post<{ message: string }>('/cameras/status/refresh', companyId ? { companyId } : undefined),

    bulkUpdateStatus: (cameraIds: string[], status: CameraStatus, companyId?: string) =>
      apiClient.post<{ updated: number }>(
        '/cameras/bulk/update',
        { cameraIds, status, ...(companyId ? { companyId } : {}) }
      ),

    bulkDelete: (cameraIds: string[], companyId?: string) =>
      apiClient.post<{ deleted: number }>(
        '/cameras/bulk/delete',
        { cameraIds, ...(companyId ? { companyId } : {}) }
      ),

    bulkTag: (cameraIds: string[], tags: string[], mode: 'add' | 'remove' | 'set', companyId?: string) =>
      apiClient.post<{ updated: number }>(
        '/cameras/bulk/tag',
        { cameraIds, tags, mode, ...(companyId ? { companyId } : {}) }
      ),
  },

  // VMS Servers (Slice 9.0)
  vms: {
    list: (params?: {
      page?: number;
      limit?: number;
      provider?: VmsProvider;
      isActive?: boolean;
      search?: string;
    }) => apiClient.get<VmsServer[]>('/vms', params as Record<string, string | number>),

    get: (id: string) => 
      apiClient.get<VmsServer>(`/vms/${id}`),

    create: (data: CreateVmsServerInput) => 
      apiClient.post<VmsServer>('/vms', data),

    update: (id: string, data: UpdateVmsServerInput) => 
      apiClient.put<VmsServer>(`/vms/${id}`, data),

    delete: (id: string) => 
      apiClient.delete<{ message: string }>(`/vms/${id}`),

    testConnection: (id: string) =>
      apiClient.post<{ success: boolean; message: string; monitors?: number }>(`/vms/${id}/test`),

    discoverMonitors: (id: string) =>
      apiClient.get<VmsMonitor[]>(`/vms/${id}/monitors`),

    importMonitors: (id: string, data: {
      monitorIds?: string[];
      defaultLocation?: { coordinates: [number, number]; address?: string };
      source?: string;
    }) =>
      apiClient.post<any[]>(`/vms/${id}/monitors/import`, data),
  },

  deleteCamerasBySource: (source: string) =>
    apiClient.delete<{ deletedCount: number }>(`/cameras/source/${source}`),
};
