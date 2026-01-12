import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { getCurrentUser } from '../utils/auth';
import styles from './CompaniesPage.module.css';

interface Company {
  _id: string;
  name: string;
  type: 'standard' | 'mobile_partner' | 'enterprise';
  status: 'active' | 'suspended' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    if (!currentUser) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      // For now, we'll show the single company
      // In a real implementation, super_admin would have GET /api/companies endpoint
      const company = await api.companies.get(currentUser!.companyId);
      setCompanies([company]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Access Denied</h2>
          <p>Only super administrators can view all companies.</p>
          <Link to="/company-settings">View your company settings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>Companies</h1>

      {loading && <div className={styles.loading}>Loading companies...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && (
        <div className={styles.companiesList}>
          {companies.length === 0 ? (
            <div className={styles.empty}>No companies found</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company._id}>
                    <td>{company.name}</td>
                    <td>{company.type}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[company.status]}`}>
                        {company.status}
                      </span>
                    </td>
                    <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/company-settings`} className={styles.link}>
                        View Settings
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
