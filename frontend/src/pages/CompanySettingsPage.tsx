import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getCurrentUser } from '../utils/auth';
import styles from './CompanySettingsPage.module.css';

interface CompanySettings {
  allowCitizenReports: boolean;
  autoLinkReportsToEvents: boolean;
  maxUsers: number;
  features: string[];
}

interface Company {
  _id: string;
  name: string;
  type: string;
  status: string;
  settings: CompanySettings;
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_FEATURES = [
  'ai_analysis',
  'live_streaming',
  'advanced_analytics',
  'mobile_app',
  'custom_branding',
];

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<CompanySettings>({
    allowCitizenReports: false,
    autoLinkReportsToEvents: false,
    maxUsers: 10,
    features: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const currentUser = getCurrentUser();

  const canManageSettings = currentUser && ['admin', 'company_admin', 'super_admin'].includes(currentUser.role);

  useEffect(() => {
    if (!currentUser) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const companyData = await api.companies.get(currentUser.companyId);
      setCompany(companyData);
      setSettings(companyData.settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field: keyof CompanySettings) => {
    if (!canManageSettings) return;
    
    setSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleMaxUsersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setSettings((prev) => ({
        ...prev,
        maxUsers: value,
      }));
    }
  };

  const handleFeatureToggle = (feature: string) => {
    if (!canManageSettings) return;
    
    setSettings((prev) => {
      const features = prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature];
      return { ...prev, features };
    });
  };

  const handleSave = async () => {
    if (!canManageSettings || !company) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await api.companies.updateSettings(company._id, settings);
      setSuccess('Settings saved successfully');
      
      // Refresh company data
      await fetchCompanySettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!company) return;

    if (!confirm('Are you sure you want to regenerate the API key? The old key will stop working immediately.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.companies.regenerateApiKey(company._id);
      setApiKey(response.apiKey);
      setShowApiKey(true);
      setSuccess('API key regenerated successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate API key');
    } finally {
      setSaving(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API key copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading company settings...</div>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          You don't have permission to view company settings.
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Company not found</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Company Settings</h1>
          <p className={styles.subtitle}>{company.name}</p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.section}>
        <h2>Company Information</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Company Name</label>
            <div className={styles.infoValue}>{company.name}</div>
          </div>
          <div className={styles.infoItem}>
            <label>Company Type</label>
            <div className={styles.infoValue}>{company.type}</div>
          </div>
          <div className={styles.infoItem}>
            <label>Status</label>
            <div className={styles.infoValue}>
              <span className={company.status === 'active' ? styles.statusActive : styles.statusInactive}>
                {company.status}
              </span>
            </div>
          </div>
          <div className={styles.infoItem}>
            <label>Created</label>
            <div className={styles.infoValue}>
              {new Date(company.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Report Settings</h2>
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <strong>Allow Citizen Reports</strong>
            <p>Enable citizens to submit reports directly</p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.allowCitizenReports}
              onChange={() => handleToggle('allowCitizenReports')}
              disabled={!canManageSettings}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <strong>Auto-Link Reports to Events</strong>
            <p>Automatically create events from citizen reports</p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={settings.autoLinkReportsToEvents}
              onChange={() => handleToggle('autoLinkReportsToEvents')}
              disabled={!canManageSettings}
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2>User Limits</h2>
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <strong>Maximum Users</strong>
            <p>Maximum number of active users allowed</p>
          </div>
          <input
            type="number"
            className={styles.numberInput}
            value={settings.maxUsers}
            onChange={handleMaxUsersChange}
            min="1"
            disabled={!canManageSettings}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2>Features</h2>
        <div className={styles.featuresGrid}>
          {AVAILABLE_FEATURES.map((feature) => (
            <label key={feature} className={styles.featureItem}>
              <input
                type="checkbox"
                checked={settings.features.includes(feature)}
                onChange={() => handleFeatureToggle(feature)}
                disabled={!canManageSettings}
              />
              <span>{feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2>API Key Management</h2>
        <p className={styles.apiKeyDescription}>
          Use this API key to authenticate mobile app and external integrations.
        </p>
        
        <button
          className={styles.dangerButton}
          onClick={handleRegenerateApiKey}
          disabled={saving}
        >
          Regenerate API Key
        </button>

        {showApiKey && apiKey && (
          <div className={styles.apiKeyDisplay}>
            <code>{apiKey}</code>
            <button className={styles.copyButton} onClick={copyApiKey}>
              Copy
            </button>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving || !canManageSettings}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
