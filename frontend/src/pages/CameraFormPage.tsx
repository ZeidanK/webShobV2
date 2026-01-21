/**
 * CameraFormPage
 * 
 * Simple form page for adding a new camera.
 * Redirects to CamerasPage after creation.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, CreateCameraInput, CameraStatus } from '../services/api';
import styles from './EventFormPage.module.css'; // Reuse event form styles

export default function CameraFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if coming from map with pre-filled coordinates
  const mapContext = location.state as { coordinates?: [number, number]; fromMap?: boolean } | null;
  const fromMap = mapContext?.fromMap && mapContext?.coordinates;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateCameraInput>({
    name: '',
    description: '',
    type: 'ip',
    status: 'online',
    location: {
      coordinates: [0, 0],
      address: '',
    },
    settings: {
      resolution: '1920x1080',
      fps: 30,
      recordingEnabled: true,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill location if coming from map
  useEffect(() => {
    if (fromMap && mapContext?.coordinates) {
      const [lng, lat] = mapContext.coordinates;
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          coordinates: [lng, lat],
        },
      }));
    }
  }, [fromMap, mapContext]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Camera name is required';
    }

    const [lng, lat] = formData.location.coordinates;
    if (lng === 0 && lat === 0) {
      newErrors.location = 'Location is required';
    }

    if (lng < -180 || lng > 180) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    if (lat < -90 || lat > 90) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.cameras.create(formData);
      navigate('/cameras');
    } catch (err: any) {
      setError(err.message || 'Failed to create camera');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateCameraInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLocationChange = (index: 0 | 1, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newCoordinates: [number, number] = [...formData.location.coordinates] as [number, number];
    newCoordinates[index] = numValue;
    
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        coordinates: newCoordinates,
      },
    }));
    
    const errorKey = index === 0 ? 'longitude' : 'latitude';
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  return (
    <div className={styles.eventFormPage}>
      <button className={styles.backButton} onClick={() => navigate('/cameras')}>
        ← Back to Cameras
      </button>

      <h1 className={styles.title}>Add New Camera</h1>
      
      {fromMap && (
        <div className={styles.mapContextBanner}>
          <span className={styles.mapContextIcon}>📍</span>
          <span>Location pre-filled from map</span>
        </div>
      )}

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Camera Name <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            className={styles.input}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter camera name..."
          />
          {errors.name && <div className={styles.errorMessage}>{errors.name}</div>}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Enter camera description..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Type</label>
          <select
            className={styles.select}
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value as 'ip' | 'analog' | 'usb')}
          >
            <option value="ip">IP Camera</option>
            <option value="analog">Analog Camera</option>
            <option value="usb">USB Camera</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Status</label>
          <select
            className={styles.select}
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value as CameraStatus)}
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="maintenance">Maintenance</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Location <span className={styles.required}>*</span>
          </label>
          {errors.location && <div className={styles.errorMessage}>{errors.location}</div>}
          <div className={styles.locationInputs}>
            <div>
              <label className={styles.label} style={{ fontSize: '12px', marginBottom: '4px' }}>
                Latitude
              </label>
              <input
                type="number"
                step="any"
                className={styles.input}
                value={formData.location.coordinates[1]}
                onChange={(e) => handleLocationChange(1, e.target.value)}
                placeholder="Latitude"
              />
              {errors.latitude && <div className={styles.errorMessage}>{errors.latitude}</div>}
            </div>
            <div>
              <label className={styles.label} style={{ fontSize: '12px', marginBottom: '4px' }}>
                Longitude
              </label>
              <input
                type="number"
                step="any"
                className={styles.input}
                value={formData.location.coordinates[0]}
                onChange={(e) => handleLocationChange(0, e.target.value)}
                placeholder="Longitude"
              />
              {errors.longitude && <div className={styles.errorMessage}>{errors.longitude}</div>}
            </div>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Address</label>
          <input
            type="text"
            className={styles.input}
            value={formData.location.address || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              location: { ...prev.location, address: e.target.value },
            }))}
            placeholder="e.g., '123 Main St, City'"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Stream URL (Optional)</label>
          <input
            type="text"
            className={styles.input}
            value={formData.streamUrl || ''}
            onChange={(e) => handleChange('streamUrl', e.target.value)}
            placeholder="rtsp://... or http://..."
          />
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Camera'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => navigate('/cameras')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
