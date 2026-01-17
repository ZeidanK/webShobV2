import { UserRole } from '../models';
import { hasMinimumRole, canAssignRole, ROLE_HIERARCHY } from './rbac.middleware';

describe('RBAC Middleware', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have correct hierarchy values', () => {
      expect(ROLE_HIERARCHY[UserRole.CITIZEN]).toBe(0);
      expect(ROLE_HIERARCHY[UserRole.FIRST_RESPONDER]).toBe(1);
      expect(ROLE_HIERARCHY[UserRole.OPERATOR]).toBe(2);
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBe(3);
      expect(ROLE_HIERARCHY[UserRole.COMPANY_ADMIN]).toBe(3);
      expect(ROLE_HIERARCHY[UserRole.SUPER_ADMIN]).toBe(5);
    });

    it('should place admin and company_admin at same level', () => {
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBe(ROLE_HIERARCHY[UserRole.COMPANY_ADMIN]);
    });
  });

  describe('hasMinimumRole', () => {
    it('should return true when user has exact required role', () => {
      expect(hasMinimumRole(UserRole.OPERATOR, UserRole.OPERATOR)).toBe(true);
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    });

    it('should return true when user has higher role', () => {
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.OPERATOR)).toBe(true);
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)).toBe(true);
      expect(hasMinimumRole(UserRole.OPERATOR, UserRole.CITIZEN)).toBe(true);
    });

    it('should return false when user has lower role', () => {
      expect(hasMinimumRole(UserRole.OPERATOR, UserRole.ADMIN)).toBe(false);
      expect(hasMinimumRole(UserRole.CITIZEN, UserRole.OPERATOR)).toBe(false);
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
    });

    it('should handle admin/company_admin equivalence', () => {
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN)).toBe(true);
      expect(hasMinimumRole(UserRole.COMPANY_ADMIN, UserRole.ADMIN)).toBe(true);
    });
  });

  describe('canAssignRole', () => {
    describe('super_admin', () => {
      it('should be able to assign any role', () => {
        expect(canAssignRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true);
        expect(canAssignRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)).toBe(true);
        expect(canAssignRole(UserRole.SUPER_ADMIN, UserRole.OPERATOR)).toBe(true);
        expect(canAssignRole(UserRole.SUPER_ADMIN, UserRole.CITIZEN)).toBe(true);
      });
    });

    describe('admin/company_admin', () => {
      it('should be able to assign roles below their level', () => {
        expect(canAssignRole(UserRole.ADMIN, UserRole.OPERATOR)).toBe(true);
        expect(canAssignRole(UserRole.ADMIN, UserRole.FIRST_RESPONDER)).toBe(true);
        expect(canAssignRole(UserRole.ADMIN, UserRole.CITIZEN)).toBe(true);

        expect(canAssignRole(UserRole.COMPANY_ADMIN, UserRole.OPERATOR)).toBe(true);
        expect(canAssignRole(UserRole.COMPANY_ADMIN, UserRole.FIRST_RESPONDER)).toBe(true);
      });

      it('should NOT be able to assign equal or higher roles', () => {
        expect(canAssignRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
        expect(canAssignRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN)).toBe(false);
        expect(canAssignRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)).toBe(false);

        expect(canAssignRole(UserRole.COMPANY_ADMIN, UserRole.ADMIN)).toBe(false);
        expect(canAssignRole(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)).toBe(false);
      });
    });

    describe('lower roles', () => {
      it('should NOT be able to assign any roles', () => {
        expect(canAssignRole(UserRole.OPERATOR, UserRole.CITIZEN)).toBe(false);
        expect(canAssignRole(UserRole.OPERATOR, UserRole.OPERATOR)).toBe(false);
        expect(canAssignRole(UserRole.OPERATOR, UserRole.ADMIN)).toBe(false);

        expect(canAssignRole(UserRole.FIRST_RESPONDER, UserRole.CITIZEN)).toBe(false);
        expect(canAssignRole(UserRole.CITIZEN, UserRole.CITIZEN)).toBe(false);
      });
    });
  });

  describe('role hierarchy enforcement scenarios', () => {
    it('should enforce: citizen < first_responder < operator < admin = company_admin < super_admin', () => {
      // Citizen is lowest
      expect(ROLE_HIERARCHY[UserRole.CITIZEN]).toBeLessThan(ROLE_HIERARCHY[UserRole.FIRST_RESPONDER]);
      
      // First responder is above citizen but below operator
      expect(ROLE_HIERARCHY[UserRole.FIRST_RESPONDER]).toBeLessThan(ROLE_HIERARCHY[UserRole.OPERATOR]);
      
      // Operator is below admin
      expect(ROLE_HIERARCHY[UserRole.OPERATOR]).toBeLessThan(ROLE_HIERARCHY[UserRole.ADMIN]);
      
      // Admin and company_admin are equal
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBe(ROLE_HIERARCHY[UserRole.COMPANY_ADMIN]);
      
      // Super admin is highest
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBeLessThan(ROLE_HIERARCHY[UserRole.SUPER_ADMIN]);
      expect(ROLE_HIERARCHY[UserRole.COMPANY_ADMIN]).toBeLessThan(ROLE_HIERARCHY[UserRole.SUPER_ADMIN]);
    });
  });

  describe('practical scenarios', () => {
    it('admin should create operator but not another admin', () => {
      expect(canAssignRole(UserRole.ADMIN, UserRole.OPERATOR)).toBe(true);
      expect(canAssignRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(false);
    });

    it('operator should not be able to create any users', () => {
      expect(canAssignRole(UserRole.OPERATOR, UserRole.CITIZEN)).toBe(false);
      expect(canAssignRole(UserRole.OPERATOR, UserRole.OPERATOR)).toBe(false);
    });

    it('super_admin can create another super_admin', () => {
      expect(canAssignRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true);
    });
  });
});
