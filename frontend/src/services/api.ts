/**
 * API Client for Event Monitoring Platform
 * Handles all HTTP requests to the backend API with:
 * - Automatic token injection
 * - Correlation ID propagation
 * - Standard error handling
 * - Response envelope unwrapping
 */

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

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async getPaginated<T>(path: string, params?: Record<string, string | number>): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handlePaginatedResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

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

  // Cameras (Slice 8)
  cameras: {
    list: (params?: { page?: number; limit?: number }) =>
      apiClient.get<unknown[]>('/cameras', params),
    get: (id: string) => apiClient.get<unknown>(`/cameras/${id}`),
    getStream: (id: string) => apiClient.get<{ streamUrl: string }>(`/cameras/${id}/stream`),
  },
};
