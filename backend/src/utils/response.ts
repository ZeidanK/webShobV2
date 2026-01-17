/**
 * Standard API response types and helpers
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: PaginationMeta;
  correlationId: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  correlationId: string,
  meta?: PaginationMeta
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
    correlationId,
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    correlationId,
  };
}

/**
 * Calculate pagination meta
 */
export function calculatePagination(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
