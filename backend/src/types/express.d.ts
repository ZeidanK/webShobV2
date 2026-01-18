import { UserRole } from '../models/user.model';
import { CompanyType } from '../models/company.model';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      user?: {
        id: string;
        companyId: string;
        role: UserRole;
        email: string;
      };
      company?: {
        id: string;
        name: string;
        type: CompanyType;
        apiKey: string;
      };
    }
  }
}

export {};