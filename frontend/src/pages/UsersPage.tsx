import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getCurrentUser } from '../utils/auth';
import UserForm from '../components/UserForm';
import styles from './UsersPage.module.css';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

const ROLES = ['citizen', 'first_responder', 'operator', 'admin', 'company_admin', 'super_admin'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // User management
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  const currentUser = getCurrentUser();

  const canManageUsers = currentUser && ['admin', 'company_admin', 'super_admin'].includes(currentUser.role);

  useEffect(() => {
    let cancelled = false;
    console.log('[UsersPage] useEffect triggered, cancelled:', cancelled);

    const fetchUsers = async () => {
      console.log('[UsersPage] fetchUsers started');
      try {
        setLoading(true);
        setError(null);
        
        const params: Record<string, string | number | boolean> = {
          page,
          pageSize,
        };
        
        if (roleFilter) params.role = roleFilter;
        if (statusFilter) params.isActive = statusFilter === 'active';
        if (searchQuery) params.search = searchQuery;

        console.log('[UsersPage] Calling api.users.list with params:', params);
        const response = await api.users.list(params);
        console.log('[UsersPage] API response received:', response);
        console.log('[UsersPage] cancelled status:', cancelled);
        
        if (!cancelled) {
          console.log('[UsersPage] Setting users:', response.users?.length);
          setUsers(response.users || []);
          setTotalPages(response.pagination?.totalPages || 1);
          setTotal(response.pagination?.total || 0);
        } else {
          console.log('[UsersPage] Effect was cancelled, not setting state');
        }
      } catch (err: unknown) {
        console.error('[UsersPage] API error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      console.log('[UsersPage] Cleanup - setting cancelled to true');
      cancelled = true;
    };
  }, [page, pageSize, roleFilter, statusFilter, searchQuery, refetchCounter]);

  const refetchUsers = () => {
    setRefetchCounter(c => c + 1);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await api.users.delete(userId);
      refetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserForm(true);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserForm(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadgeClass = (role: string) => {
    const roleMap: Record<string, string> = {
      citizen: styles.roleCitizen,
      first_responder: styles.roleFirstResponder,
      operator: styles.roleOperator,
      admin: styles.roleAdmin,
      company_admin: styles.roleCompanyAdmin,
      super_admin: styles.roleSuperAdmin,
    };
    return roleMap[role] || '';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading users...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>User Management</h1>
        {canManageUsers && (
          <button className={styles.addButton} onClick={handleAddUser}>
            + Add User
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Search by name or email..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className={styles.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              {canManageUsers && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(!users || users.length === 0) ? (
              <tr>
                <td colSpan={canManageUsers ? 6 : 5} className={styles.emptyState}>
                  {error ? 'Failed to load users' : 'No users found'}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id}>
                  <td>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`${styles.roleBadge} ${getRoleBadgeClass(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className={user.isActive ? styles.statusActive : styles.statusInactive}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  {canManageUsers && (
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEditUser(user)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteUser(user._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.paginationButton}
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className={styles.paginationInfo}>
            Page {page} of {totalPages} ({total} users)
          </span>
          <button
            className={styles.paginationButton}
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {showUserForm && (
        <div className={styles.modal} onClick={() => setShowUserForm(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <UserForm
              user={editingUser}
              currentUserRole={currentUser.role}
              onSuccess={() => {
                setShowUserForm(false);
                setEditingUser(null);
                refetchUsers();
              }}
              onCancel={() => {
                setShowUserForm(false);
                setEditingUser(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
