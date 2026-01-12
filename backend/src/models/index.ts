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
export { 
  Report, 
  ReportSource, 
  ReportType, 
  ReportStatus, 
  AttachmentType,
  IReport, 
  IAttachment,
  ILocation 
} from './report.model';

// Slice 4: Event Management
export { 
  Event, 
  EventStatus, 
  EventPriority, 
  IEvent 
} from './event.model';
export { 
  EventType, 
  SYSTEM_EVENT_TYPES, 
  IEventType 
} from './event-type.model';

// Slice 7: Camera Management
// export { Camera } from './camera.model';
