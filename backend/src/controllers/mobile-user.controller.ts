import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/user.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { websocketService } from '../services/websocket.service';

/**
 * Mobile User Controller
 * Handles user-related operations for mobile apps (location tracking, etc.)
 */

/**
 * Update responder location
 * POST /api/mobile/users/location
 */
export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location, accuracy } = req.body;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const userRole = req.user!.role;

    // Verify user is a first responder
    if (userRole !== UserRole.FIRST_RESPONDER) {
      throw new AppError('ACCESS_DENIED', 'Only first responders can update location', 403);
    }

    // Validate location format (GeoJSON Point)
    if (!location || !location.type || location.type !== 'Point') {
      throw new AppError('INVALID_LOCATION_FORMAT', 'Location must be a GeoJSON Point', 400);
    }

    if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      throw new AppError('INVALID_COORDINATES', 'Coordinates must be an array with exactly 2 elements [lng, lat]', 400);
    }

    // Validate coordinates (longitude, latitude)
    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      throw new AppError('INVALID_COORDINATE_TYPES', 'Coordinates must be numbers', 400);
    }

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new AppError('COORDINATES_OUT_OF_RANGE', 'Longitude must be [-180, 180], latitude must be [-90, 90]', 400);
    }

    // Validate accuracy (if provided)
    if (accuracy !== undefined && (typeof accuracy !== 'number' || accuracy < 0)) {
      throw new AppError('INVALID_ACCURACY', 'Accuracy must be a positive number', 400);
    }

    // Find the user
    const user = await User.findOne({
      _id: userId,
      companyId,
      isActive: true,
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Update user location
    const locationUpdate = {
      type: 'Point',
      coordinates: [lng, lat],
    };

    const previousLocation = user.location;

    // Update user location and metadata
    user.location = locationUpdate as any;
    user.locationAccuracy = accuracy;
    user.locationUpdatedAt = new Date();

    await user.save();

    // Create audit log (only if location changed significantly to avoid spam)
    let shouldAudit = true;
    if (previousLocation && previousLocation.coordinates) {
      const [prevLng, prevLat] = previousLocation.coordinates;
      const distance = calculateDistance(prevLat, prevLng, lat, lng);
      
      // Only audit if moved more than 10 meters
      shouldAudit = distance > 0.01; // Approximately 10 meters
    }

    if (shouldAudit) {
      await AuditLog.create({
        action: AuditAction.USER_LOCATION_UPDATED,
        companyId,
        userId,
        resourceType: 'User',
        resourceId: user._id,
        changes: {
          location: locationUpdate,
          accuracy,
          previousLocation,
          updatedVia: 'mobile',
        },
        correlationId: req.correlationId,
      });
    }

    logger.debug({
      action: 'mobile.user.location.update.success',
      context: {
        userId,
        companyId,
        coordinates: [lng, lat],
        accuracy,
        shouldAudit,
      },
      correlationId: req.correlationId,
    });

    // Emit WebSocket event for real-time responder tracking
    websocketService.broadcastToCompany(companyId, 'responder:location', {
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      location: locationUpdate,
      accuracy,
      updatedAt: user.locationUpdatedAt,
    });

    res.json({
      success: true,
      data: {
        message: 'Location updated successfully',
        location: locationUpdate,
        accuracy,
        updatedAt: user.locationUpdatedAt,
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get responder's current location
 * GET /api/mobile/users/location
 */
export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const userRole = req.user!.role;

    // Verify user is a first responder
    if (userRole !== UserRole.FIRST_RESPONDER) {
      throw new AppError('ACCESS_DENIED', 'Only first responders can access location data', 403);
    }

    // Find the user
    const user = await User.findOne({
      _id: userId,
      companyId,
      isActive: true,
    }).select('location locationAccuracy locationUpdatedAt firstName lastName');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    res.json({
      success: true,
      data: {
        userId,
        firstName: user.firstName,
        lastName: user.lastName,
        location: user.location,
        accuracy: user.locationAccuracy,
        updatedAt: user.locationUpdatedAt,
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}