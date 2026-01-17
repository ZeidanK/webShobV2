/**
 * Custom Type Definitions
 */

import { Request } from 'express';
import { UserRole } from '../models/user.model';

/**
 * Extended Express Request with app-specific properties
 */
export interface AppRequest extends Request {
  correlationId: string;
  user?: {
    id: string;
    companyId: string;
    role: UserRole;
    email: string;
  };
}

/**
 * Event status lifecycle
 */
export type EventStatus = 'active' | 'assigned' | 'resolved' | 'closed';

/**
 * Event priority levels
 */
export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Report types
 */
export type ReportType = 'citizen' | 'camera' | 'responder';

/**
 * Report verification status
 */
export type ReportStatus = 'submitted' | 'under_review' | 'verified' | 'rejected';

/**
 * Camera status
 */
export type CameraStatusType = 'online' | 'offline' | 'maintenance' | 'error';

/**
 * VMS types supported
 */
export type VMSType = 'direct' | 'milestone' | 'genetec';

/**
 * GeoJSON Point type for MongoDB geo-spatial queries
 */
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sort?: string;
}

/**
 * Common filter options
 */
export interface FilterOptions {
  search?: string;
  startDate?: Date;
  endDate?: Date;
}
