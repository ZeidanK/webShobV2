import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, CreateEventInput, EventType } from '../services/api';
import styles from './EventFormPage.module.css';

export default function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateEventInput>({
    title: '',
    description: '',
    priority: 'medium',
    eventTypeId: '',
    location: {
      longitude: 0,
      latitude: 0,
    },
    locationDescription: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    loadEventTypes();
    if (isEdit) {
      loadEvent();
    }
  }, [isEdit, id]);

  const loadEventTypes = async () => {
    try {
      const types = await api.eventTypes.list();
      setEventTypes(types);
      if (types.length > 0 && !formData.eventTypeId) {
        setFormData(prev => ({ ...prev, eventTypeId: types[0]._id }));
      }
    } catch (err: any) {
      console.error('[EventFormPage] Error loading event types:', err);
      setError('Failed to load event types');
    }
  };

  const loadEvent = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const event = await api.events.get(id);
      setFormData({
        title: event.title,
        description: event.description || '',
        priority: event.priority,
        eventTypeId: typeof event.eventTypeId === 'string' ? event.eventTypeId : event.eventTypeId._id,
        location: {
          longitude: event.location.coordinates[0],
          latitude: event.location.coordinates[1],
        },
        locationDescription: event.locationDescription || '',
        notes: event.notes || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.eventTypeId) {
      newErrors.eventTypeId = 'Event type is required';
    }

    if (formData.location.longitude < -180 || formData.location.longitude > 180) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    if (formData.location.latitude < -90 || formData.location.latitude > 90) {
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

      if (isEdit && id) {
        await api.events.update(id, formData);
      } else {
        await api.events.create(formData);
      }

      navigate('/events');
    } catch (err: any) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} event`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateEventInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLocationChange = (field: 'longitude' | 'latitude', value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: numValue,
      },
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }));
        setGettingLocation(false);
        setErrors(prev => ({ ...prev, latitude: '', longitude: '' }));
      },
      (error) => {
        setError(`Failed to get location: ${error.message}`);
        setGettingLocation(false);
      }
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading event...</div>;
  }

  return (
    <div className={styles.eventFormPage}>
      <button className={styles.backButton} onClick={() => navigate('/events')}>
        ← Back to Events
      </button>

      <h1 className={styles.title}>{isEdit ? 'Edit Event' : 'Create New Event'}</h1>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Title <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            className={styles.input}
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter event title..."
          />
          {errors.title && <div className={styles.errorMessage}>{errors.title}</div>}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Enter event description..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Priority <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={formData.priority}
            onChange={(e) => handleChange('priority', e.target.value as any)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Event Type <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={formData.eventTypeId}
            onChange={(e) => handleChange('eventTypeId', e.target.value)}
          >
            <option value="">Select an event type...</option>
            {eventTypes.map(type => (
              <option key={type._id} value={type._id}>
                {type.name} ({type.category})
              </option>
            ))}
          </select>
          {errors.eventTypeId && <div className={styles.errorMessage}>{errors.eventTypeId}</div>}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Location <span className={styles.required}>*</span>
          </label>
          <button
            type="button"
            className={styles.locationButton}
            onClick={handleGetCurrentLocation}
            disabled={gettingLocation}
          >
            {gettingLocation ? '📍 Getting location...' : '📍 Use Current Location'}
          </button>
          <div className={styles.locationInputs}>
            <div>
              <input
                type="number"
                step="any"
                className={styles.input}
                value={formData.location.latitude}
                onChange={(e) => handleLocationChange('latitude', e.target.value)}
                placeholder="Latitude"
              />
              {errors.latitude && <div className={styles.errorMessage}>{errors.latitude}</div>}
            </div>
            <div>
              <input
                type="number"
                step="any"
                className={styles.input}
                value={formData.location.longitude}
                onChange={(e) => handleLocationChange('longitude', e.target.value)}
                placeholder="Longitude"
              />
              {errors.longitude && <div className={styles.errorMessage}>{errors.longitude}</div>}
            </div>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Location Description</label>
          <input
            type="text"
            className={styles.input}
            value={formData.locationDescription}
            onChange={(e) => handleChange('locationDescription', e.target.value)}
            placeholder="e.g., 'Downtown Plaza, Main Street'"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Additional notes..."
          />
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={() => navigate('/events')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
