import { Request, Response, NextFunction } from 'express';
import { Company, CompanyType } from '../models/company.model';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * API Key Scope Definitions
 * Defines which company types can access which endpoint scopes
 */
interface ApiKeyScope {
  companyTypes: CompanyType[];
  endpoints: string[];
  description: string;
}

const API_KEY_SCOPES: Record<string, ApiKeyScope> = {
  mobile: {
    companyTypes: [CompanyType.MOBILE_PARTNER, CompanyType.STANDARD, CompanyType.ENTERPRISE],
    endpoints: ['/api/mobile/*'],
    description: 'Mobile API access for report submission and responder functions',
  },
  // Future scopes can be added here
  integration: {
    companyTypes: [CompanyType.ENTERPRISE],
    endpoints: ['/api/integration/*', '/api/webhooks/*'],
    description: 'Integration API access for enterprise customers',
  },
};

/**
 * Middleware to enforce API key scoping
 * Restricts endpoints based on company type associated with the API key
 */
export function apiKeyScoping(allowedScopes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only apply scoping if API key is being used
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        // No API key = no scoping needed (will be handled by auth middleware)
        return next();
      }

      // Find company by API key
      const company = await Company.findOne({ apiKey }).select('+apiKey');
      
      if (!company) {
        throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
      }

      // Check if company type is allowed for any of the requested scopes
      const hasValidScope = allowedScopes.some((scope) => {
        const scopeConfig = API_KEY_SCOPES[scope];
        if (!scopeConfig) {
          logger.warn({
            action: 'api_key_scoping.unknown_scope',
            context: {
              scope,
              companyId: company._id.toString(),
              path: req.path,
            },
            correlationId: req.correlationId,
          });
          return false;
        }

        return scopeConfig.companyTypes.includes(company.type);
      });

      if (!hasValidScope) {
        logger.warn({
          action: 'api_key_scoping.access_denied',
          context: {
            companyId: company._id.toString(),
            companyType: company.type,
            requiredScopes: allowedScopes,
            path: req.path,
          },
          correlationId: req.correlationId,
        });

        throw new AppError(
          'API_SCOPE_DENIED',
          `Company type '${company.type}' is not authorized to access this endpoint`,
          403
        );
      }

      // Attach company to request for later use
      req.company = {
        id: company._id.toString(),
        name: company.name,
        type: company.type,
        apiKey: company.apiKey,
      };

      logger.debug({
        action: 'api_key_scoping.allowed',
        context: {
          companyId: company._id.toString(),
          companyType: company.type,
          allowedScopes,
          path: req.path,
        },
        correlationId: req.correlationId,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Get available API key scopes for a company type
 */
export function getAvailableScopes(companyType: CompanyType): string[] {
  return Object.entries(API_KEY_SCOPES)
    .filter(([_, config]) => config.companyTypes.includes(companyType))
    .map(([scope]) => scope);
}

// Note: Express Request type extension is now in src/types/express.d.ts