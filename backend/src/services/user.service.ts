import mongoose from 'mongoose';
import { User, IUser, UserRole } from '../models/user.model';
import { AuditLog, AuditAction } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { canAssignRole } from '../middleware/rbac.middleware';

/**
 * User Service
 * Handles user CRUD operations with tenant isolation and RBAC
 */
export class UserService {
  /**
   * Create a new user (admin creates users within their company)
   */
  static async createUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    companyId: string;
    createdBy: string;
    createdByRole: UserRole;
    correlationId: string;
  }): Promise<IUser> {
    
    

    try {
      logger.info({
        action: 'user.create.start',
        context: { email: data.email, role: data.role, companyId: data.companyId },
        correlationId: data.correlationId,
      });

      // Validate role assignment
      if (!canAssignRole(data.createdByRole, data.role)) {
        throw new AppError(
          'ROLE_HIERARCHY_VIOLATION',
          `Cannot create user with role ${data.role}`,
          403
        );
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        throw new AppError('USER_EXISTS', 'A user with this email already exists', 400);
      }

      // Create user
      const user = new User({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        companyId: data.companyId,
        createdBy: data.createdBy,
        isActive: true,
      });

      await user.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.USER_CREATED,
        resourceType: 'User',
        resourceId: user._id,
        companyId: data.companyId,
        performedBy: data.createdBy,
        changes: {
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        correlationId: data.correlationId,
      });

      logger.info({
        action: 'user.create.success',
        context: { userId: user._id.toString(), email: user.email },
        correlationId: data.correlationId,
      });

      // Remove password from returned object
      const userObj = user.toObject() as any;
      delete userObj.password;

      return userObj as IUser;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'user.create.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: data.correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to create user', 500);
    }
  }

  /**
   * Get users with company-scoped filtering and pagination
   */
  static async getUsers(options: {
    companyId: string;
    requestingUserRole: UserRole;
    page?: number;
    pageSize?: number;
    role?: UserRole;
    isActive?: boolean;
    search?: string;
  }): Promise<{ users: IUser[]; total: number; page: number; pageSize: number }> {
    try {
      const page = options.page || 1;
      const pageSize = Math.min(options.pageSize || 20, 100);
      const skip = (page - 1) * pageSize;

      // Build filter with tenant isolation
      // super_admin can see all users, others only see their company
      const filter: any = {};
      
      if (options.requestingUserRole !== UserRole.SUPER_ADMIN) {
        // Non-super admins are restricted to their company
        const companyObjectId = new mongoose.Types.ObjectId(options.companyId);
        filter.companyId = companyObjectId;
      } else if (options.companyId) {
        // super_admin can optionally filter by companyId
        const companyObjectId = new mongoose.Types.ObjectId(options.companyId);
        filter.companyId = companyObjectId;
      }

      logger.debug({
        action: 'user.list.filter',
        context: { 
          companyIdInput: options.companyId,
          requestingUserRole: options.requestingUserRole,
          filter 
        },
      });

      if (options.role) {
        filter.role = options.role;
      }

      if (options.isActive !== undefined) {
        filter.isActive = options.isActive;
      }

      if (options.search) {
        filter.$or = [
          { email: { $regex: options.search, $options: 'i' } },
          { firstName: { $regex: options.search, $options: 'i' } },
          { lastName: { $regex: options.search, $options: 'i' } },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-password -refreshToken -refreshTokenExpiry -passwordResetToken -passwordResetExpiry')
          .skip(skip)
          .limit(pageSize)
          .sort({ createdAt: -1 })
          .exec(),
        User.countDocuments(filter).exec(),
      ]);

      return {
        users,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error({
        action: 'user.list.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId: options.companyId },
      });

      throw new AppError('DATABASE_ERROR', 'Failed to retrieve users', 500);
    }
  }

  /**
   * Get user by ID with tenant isolation
   */
  static async getUserById(
    userId: string,
    requestingUserCompanyId: string,
    requestingUserRole: UserRole
  ): Promise<IUser> {
    try {
      const user = await User.findById(userId)
        .select('-password -refreshToken -refreshTokenExpiry -passwordResetToken -passwordResetExpiry')
        .exec();

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Tenant isolation check (super_admin can access any user)
      if (
        requestingUserRole !== UserRole.SUPER_ADMIN &&
        user.companyId.toString() !== requestingUserCompanyId
      ) {
        throw new AppError('TENANT_MISMATCH', 'Cannot access user from another company', 403);
      }

      return user;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'user.get.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { userId },
      });

      throw new AppError('DATABASE_ERROR', 'Failed to retrieve user', 500);
    }
  }

  /**
   * Update user
   */
  static async updateUser(data: {
    userId: string;
    updates: {
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      isActive?: boolean;
    };
    updatedBy: string;
    updatedByRole: UserRole;
    requestingUserCompanyId: string;
    correlationId: string;
  }): Promise<IUser> {
    
    

    try {
      logger.info({
        action: 'user.update.start',
        context: { userId: data.userId },
        correlationId: data.correlationId,
      });

      const user = await User.findById(data.userId);

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Tenant isolation check
      if (
        data.updatedByRole !== UserRole.SUPER_ADMIN &&
        user.companyId.toString() !== data.requestingUserCompanyId
      ) {
        throw new AppError('TENANT_MISMATCH', 'Cannot update user from another company', 403);
      }

      // Validate role change if provided
      if (data.updates.role && data.updates.role !== user.role) {
        if (!canAssignRole(data.updatedByRole, data.updates.role)) {
          throw new AppError(
            'ROLE_HIERARCHY_VIOLATION',
            `Cannot assign role ${data.updates.role}`,
            403
          );
        }
      }

      const oldValues: any = {};
      const newValues: any = {};

      // Update fields
      if (data.updates.firstName !== undefined) {
        oldValues.firstName = user.firstName;
        newValues.firstName = data.updates.firstName;
        user.firstName = data.updates.firstName;
      }

      if (data.updates.lastName !== undefined) {
        oldValues.lastName = user.lastName;
        newValues.lastName = data.updates.lastName;
        user.lastName = data.updates.lastName;
      }

      if (data.updates.role !== undefined) {
        oldValues.role = user.role;
        newValues.role = data.updates.role;
        user.role = data.updates.role;
      }

      if (data.updates.isActive !== undefined) {
        oldValues.isActive = user.isActive;
        newValues.isActive = data.updates.isActive;
        user.isActive = data.updates.isActive;
      }

      user.updatedBy = new mongoose.Types.ObjectId(data.updatedBy);

      await user.save();

      // Create audit log
      await AuditLog.create(
        [
          {
            action: AuditAction.USER_UPDATED,
            resourceType: 'User',
            resourceId: user._id,
            companyId: user.companyId,
            performedBy: data.updatedBy,
            changes: {
              old: oldValues,
              new: newValues,
            },
            correlationId: data.correlationId,
          },
        ],
        
      );

      

      logger.info({
        action: 'user.update.success',
        context: { userId: user._id.toString() },
        correlationId: data.correlationId,
      });

      // Remove sensitive fields
      const userObj = user.toObject() as any;
      delete userObj.password;

      return userObj as IUser;
    } catch (error) {
      
      
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'user.update.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { userId: data.userId },
        correlationId: data.correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to update user', 500);
    } finally {
      
    }
  }

  /**
   * Soft delete user (set isActive to false)
   */
  static async deleteUser(data: {
    userId: string;
    deletedBy: string;
    deletedByRole: UserRole;
    requestingUserCompanyId: string;
    correlationId: string;
  }): Promise<void> {
    
    

    try {
      logger.info({
        action: 'user.delete.start',
        context: { userId: data.userId },
        correlationId: data.correlationId,
      });

      const user = await User.findById(data.userId);

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }

      // Tenant isolation check
      if (
        data.deletedByRole !== UserRole.SUPER_ADMIN &&
        user.companyId.toString() !== data.requestingUserCompanyId
      ) {
        throw new AppError('TENANT_MISMATCH', 'Cannot delete user from another company', 403);
      }

      // Prevent self-deletion
      if (user._id.toString() === data.deletedBy) {
        throw new AppError('SELF_DELETION', 'Cannot delete your own account', 400);
      }

      // Soft delete
      user.isActive = false;
      user.updatedBy = new mongoose.Types.ObjectId(data.deletedBy);

      await user.save();

      // Create audit log
      await AuditLog.create(
        [
          {
            action: AuditAction.USER_DELETED,
            resourceType: 'User',
            resourceId: user._id,
            companyId: user.companyId,
            performedBy: data.deletedBy,
            changes: {
              action: 'soft_delete',
              email: user.email,
            },
            correlationId: data.correlationId,
          },
        ],
        
      );

      

      logger.info({
        action: 'user.delete.success',
        context: { userId: user._id.toString() },
        correlationId: data.correlationId,
      });
    } catch (error) {
      
      
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'user.delete.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { userId: data.userId },
        correlationId: data.correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to delete user', 500);
    } finally {
      
    }
  }
}
