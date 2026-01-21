// Keep hook imports minimal for typecheck clarity.
import { useState } from 'react';
import { api } from '../services/api';
import styles from './UserForm.module.css';

interface UserFormProps {
  user?: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
  currentUserRole: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  citizen: 0,
  first_responder: 1,
  operator: 2,
  admin: 3,
  company_admin: 3,
  super_admin: 5,
};

export default function UserForm({ user, onSuccess, onCancel, currentUserRole }: UserFormProps) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    role: user?.role || 'citizen',
    isActive: user?.isActive ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!user;
  const currentUserLevel = ROLE_HIERARCHY[currentUserRole] || 0;

  // Filter roles based on hierarchy - can only assign roles below your level
  const availableRoles = Object.keys(ROLE_HIERARCHY).filter((role) => {
    const roleLevel = ROLE_HIERARCHY[role];
    return roleLevel < currentUserLevel;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.email.trim()) {
      return 'Email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!isEditMode && !formData.password) {
      return 'Password is required for new users';
    }
    if (formData.password && formData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!formData.firstName.trim()) {
      return 'First name is required';
    }
    if (!formData.lastName.trim()) {
      return 'Last name is required';
    }
    if (!formData.role) {
      return 'Role is required';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEditMode) {
        // Update existing user
        const updateData: Record<string, string | boolean> = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          isActive: formData.isActive,
        };
        
        // Only include role if it changed
        if (formData.role !== user.role) {
          updateData.role = formData.role;
        }

        await api.users.update(user._id, updateData);
      } else {
        // Create new user
        await api.users.create({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        });
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>{isEditMode ? 'Edit User' : 'Add New User'}</h2>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formGroup}>
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled={isEditMode} // Email cannot be changed
          required
        />
        {isEditMode && (
          <small className={styles.helpText}>Email cannot be changed</small>
        )}
      </div>

      {!isEditMode && (
        <div className={styles.formGroup}>
          <label htmlFor="password">Password *</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Minimum 8 characters"
            required
          />
        </div>
      )}

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="firstName">First Name *</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="lastName">Last Name *</label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="role">Role *</label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
        >
          {availableRoles.length === 0 ? (
            <option value="">No roles available</option>
          ) : (
            availableRoles.map((role) => (
              <option key={role} value={role}>
                {role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))
          )}
        </select>
        <small className={styles.helpText}>
          You can only assign roles below your level
        </small>
      </div>

      {isEditMode && (
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />
            <span>Active Account</span>
          </label>
          <small className={styles.helpText}>
            Inactive accounts cannot log in
          </small>
        </div>
      )}

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading || availableRoles.length === 0}
        >
          {loading ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
