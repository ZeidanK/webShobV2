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

  // Reports (Slice 4)
  reports: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get<unknown[]>('/reports', params),
    get: (id: string) => apiClient.get<unknown>(`/reports/${id}`),
    create: (data: unknown) => apiClient.post<unknown>('/reports', data),
    update: (id: string, data: unknown) => apiClient.patch<unknown>(`/reports/${id}`, data),
  },

  // Events (Slice 5)
  events: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      apiClient.get<unknown[]>('/events', params),
    get: (id: string) => apiClient.get<unknown>(`/events/${id}`),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<unknown>(`/events/${id}/status`, { status }),
    assign: (id: string, userId: string) =>
      apiClient.patch<unknown>(`/events/${id}/assign`, { userId }),
  },

  // Cameras (Slice 8)
  cameras: {
    list: (params?: { page?: number; limit?: number }) =>
      apiClient.get<unknown[]>('/cameras', params),
    get: (id: string) => apiClient.get<unknown>(`/cameras/${id}`),
    getStream: (id: string) => apiClient.get<{ streamUrl: string }>(`/cameras/${id}/stream`),
  },
};
