import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, EventType } from '../services/api';
import styles from './ReportSubmissionPage.module.css';

interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface FormData {
  title: string;
  description: string;
  type: string;
  customType?: string;
  location?: LocationData;
  manualLat?: string;
  manualLng?: string;
  // Optional user-provided location notes.
  locationDescription?: string;
}

const DEFAULT_REPORT_TYPES = [
  { value: 'incident', label: 'Security Incident' },
  { value: 'maintenance', label: 'Maintenance Request' },
  { value: 'safety', label: 'Safety Concern' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom Type...' },
] as const;

const ReportSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    type: 'incident',
    customType: '',
    location: undefined,
    manualLat: '',
    manualLng: '',
    locationDescription: '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [useManualLocation, setUseManualLocation] = useState(false);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const types = await api.eventTypes.list();
        setEventTypes(types);
      } catch (error) {
        console.error('Failed to load event types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchEventTypes();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleManualLocation = () => {
    const lat = parseFloat(formData.manualLat || '');
    const lng = parseFloat(formData.manualLng || '');

    if (isNaN(lat) || isNaN(lng)) {
      setLocationError('Please enter valid latitude and longitude');
      return;
    }

    if (lat < -90 || lat > 90) {
      setLocationError('Latitude must be between -90 and 90');
      return;
    }

    if (lng < -180 || lng > 180) {
      setLocationError('Longitude must be between -180 and 180');
      return;
    }

    setFormData(prev => ({
      ...prev,
      location: { lat, lng },
    }));
    setLocationError('');
  };

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        }));
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Validate file count
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file sizes and types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
    const validFiles: File[] = [];

    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(`File "${file.name}" is not a supported format. Supported: JPEG, PNG, GIF, MP4, MOV`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Create previews for valid files
    const newPreviews: string[] = [];
    const previewPromises = validFiles.map((file) => {
      return new Promise<void>((resolve) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            newPreviews.push(e.target?.result as string);
            resolve();
          };
          reader.readAsDataURL(file);
        } else {
          // For videos, use a placeholder or video thumbnail
          newPreviews.push(''); // Empty string for video placeholder
          resolve();
        }
      });
    });

    Promise.all(previewPromises).then(() => {
      setFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...newPreviews]);
    });

    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }

      // Determine the report type
      const reportType = formData.type === 'custom' 
        ? (formData.customType?.trim() || 'other')
        : formData.type;

      // Create the report
      const reportData: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: reportType,
      };

      // Add location if provided
      if (formData.location) {
        reportData.location = {
          longitude: formData.location.lng,
          latitude: formData.location.lat,
        };
      }

      // Add location description if provided
      if (formData.locationDescription) {
        reportData.locationDescription = formData.locationDescription.trim();
      }

      const report = await api.reports.create(reportData);

      // Upload files if any
      if (files.length > 0) {
        await api.reports.addAttachments(report._id, files);
      }

      // Navigate to success page or reports list
      navigate('/reports', { 
        state: { 
          message: 'Report submitted successfully. It will be reviewed by our operators.',
          reportId: report._id 
        } 
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Submit Report</h1>
        <p>Report incidents, maintenance needs, or safety concerns to help keep our community secure.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h2>Report Details</h2>
          
          <div className={styles.field}>
            <label htmlFor="title">Title*</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Brief description of the issue"
              maxLength={100}
              required
            />
            <span className={styles.charCount}>{formData.title.length}/100</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="type">Report Type*</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              required
              disabled={loadingTypes}
            >
              {loadingTypes ? (
                <option>Loading types...</option>
              ) : (
                <>
                  {DEFAULT_REPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                  {eventTypes.length > 0 && <option disabled>── Event Types ──</option>}
                  {eventTypes.map((type) => (
                    <option key={type._id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {formData.type === 'custom' && (
            <div className={styles.field}>
              <label htmlFor="customType">Custom Type*</label>
              <input
                type="text"
                id="customType"
                name="customType"
                value={formData.customType}
                onChange={handleInputChange}
                placeholder="Enter custom report type"
                maxLength={50}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="description">Description*</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Please provide detailed information about the incident or issue..."
              rows={6}
              maxLength={2000}
              required
            />
            <span className={styles.charCount}>{formData.description.length}/2000</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Location</h2>
          <p className={styles.sectionDescription}>
            Adding location information helps operators respond more effectively.
          </p>

          <div className={styles.locationSection}>
            {formData.location ? (
              <div className={styles.locationInfo}>
                <div className={styles.locationDisplay}>
                  <span className={styles.coordinates}>Location: {formData.location.lat.toFixed(6)}, {formData.location.lng.toFixed(6)}</span>
                  {formData.location.accuracy && (
                    <span className={styles.accuracy}>Accuracy: +/- {Math.round(formData.location.accuracy)}m</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, location: undefined, manualLat: '', manualLng: '' }))}
                  className={styles.removeLocationButton}
                >
                  Remove Location
                </button>
              </div>
            ) : (
              <>
                <div className={styles.locationButtons}>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={isGettingLocation || useManualLocation}
                    className={styles.locationButton}
                  >
                    {isGettingLocation ? 'Getting Location...' : 'Get Current Location'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseManualLocation(!useManualLocation)}
                    className={styles.locationButton}
                  >
                    {useManualLocation ? 'Cancel Manual Entry' : 'Enter Manually'}
                  </button>
                </div>

                {useManualLocation && (
                  <div className={styles.manualLocationFields}>
                    <div className={styles.field}>
                      <label htmlFor="manualLat">Latitude</label>
                      <input
                        type="number"
                        id="manualLat"
                        name="manualLat"
                        value={formData.manualLat}
                        onChange={handleInputChange}
                        placeholder="e.g., 32.0853"
                        step="any"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="manualLng">Longitude</label>
                      <input
                        type="number"
                        id="manualLng"
                        name="manualLng"
                        value={formData.manualLng}
                        onChange={handleInputChange}
                        placeholder="e.g., 34.7818"
                        step="any"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleManualLocation}
                      className={styles.locationButton}
                    >
                      Set Location
                    </button>
                  </div>
                )}
              </>
            )}

            {locationError && (
              <div className={styles.error}>{locationError}</div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h2>Attachments</h2>
          <p className={styles.sectionDescription}>
            Upload photos or videos to help document the issue (max 5 files, 10MB each).
          </p>

          <div className={styles.fileSection}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/jpeg,image/jpg,image/png,image/gif,video/mp4,video/quicktime"
              className={styles.fileInput}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={styles.fileButton}
              disabled={files.length >= 5}
            >
              Choose Files {files.length > 0 && `(${files.length}/5)`}
            </button>

            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map((file, index) => (
                  <div key={index} className={styles.fileItem}>
                    <div className={styles.filePreview}>
                      {file.type.startsWith('image/') && filePreviews[index] ? (
                        <img 
                          src={filePreviews[index]} 
                          alt={file.name}
                          className={styles.imagePreview}
                        />
                      ) : (
                        <div className={styles.videoPreview}>Video</div>
                      )}
                    </div>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button type="button" onClick={() => removeFile(index)} className={styles.removeFileButton} aria-label={`Remove ${file.name}`}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {submitError && (
          <div className={styles.error}>{submitError}</div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={styles.cancelButton}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportSubmissionPage;

