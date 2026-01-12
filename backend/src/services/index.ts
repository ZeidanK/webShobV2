/**
 * Services Index
 * 
 * This file will export all service modules.
 * Services will be created in subsequent slices.
 */

// Slice 1: Auth Core
export { AuthService } from './auth.service';

// Slice 2: Company & User CRUD
export { CompanyService } from './company.service';
export { UserService } from './user.service';

// Slice 3: Report Submission
export { ReportService } from './report.service';

// Slice 4: Event Management
// export { EventService } from './event.service';
// export { EventTypeService } from './event-type.service';
// export { AuditService } from './audit.service';

// Slice 5: Real-Time Foundation
// export { WebSocketService } from './websocket.service';

// Slice 7: Camera Management
// export { CameraService } from './camera.service';

// Slice 9: VMS Adapters
// export { VMSAdapterService } from './vms-adapter.service';

export {};
