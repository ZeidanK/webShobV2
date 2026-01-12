/**
 * Models Index
 * 
 * This file will export all Mongoose models.
 * Models will be created in subsequent slices.
 */

// Slice 1: Auth Core
export { User, UserRole, IUser, IUserModel } from './user.model';
export { AuditLog, AuditAction, IAuditLog } from './audit-log.model';

// Slice 2: Company & User CRUD
export { Company, CompanyType, CompanyStatus, ICompany, ICompanySettings } from './company.model';

// Slice 3: Report Submission
// export { Report } from './report.model';

// Slice 4: Event Management
// export { Event } from './event.model';
// export { EventType } from './event-type.model';

// Slice 7: Camera Management
// export { Camera } from './camera.model';
