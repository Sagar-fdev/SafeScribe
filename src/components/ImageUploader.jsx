import { useState, useRef } from 'react';
import { useNotes } from '../context/NotesContext';
import PinModal from './PinModal';
import { comparePin, generateRecoveryCode } from '../lib/crypto';
import './ImageUploader.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function ImageUploader({ onClose }) {
  const { addNote, unlockedPin, setUnlockedPin, profile } = useNotes();
  const [imageData, setImageData] = useState(null);
  const [title, setTitle] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef();

  const processFile = (file) => {
    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image');
      return;
    }

    if (file.size > MAX_SIZE) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => {
      setIsLoading(true);
      setReadProgress(0);
    };

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setReadProgress(percent);
      }
    };

    reader.onload = (e) => {
      setImageData({
        data: e.target.result,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    };

    reader.onloadend = () => {
      setIsLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!imageData) {
      setError('Please select an image');
      return;
    }

    if (isProtected) {
      if (unlockedPin) {
        saveImage(unlockedPin);
      } else {
        setPinError('');
        setShowPinModal(true);
      }
      return;
    }

    saveImage(null);
  };

  const saveImage = async (pin, recCode) => {
    setIsSaving(true);
    setError('');
    try {
      await addNote({
        type: 'image',
        decryptedTitle: title.trim() || imageData.name || 'Untitled Image',
        decryptedContent: imageData.data,
        imageName: imageData.name,
        imageSize: imageData.size,
        isProtected,
        protectionPin: pin,
      }, pin, recCode);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePinSubmit = (pin) => {
    if (profile?.pin_hash) {
      if (comparePin(pin, profile.pin_hash)) {
        setUnlockedPin(pin);
        setShowPinModal(false);
        saveImage(pin);
      } else {
        setPinError('Incorrect PIN. Please try again.');
      }
    } else {
      const code = generateRecoveryCode();
      setPendingPin(pin);
      setRecoveryCode(code);
      setShowPinModal(false);
    }
  };

  const handleConfirmRecoveryCode = () => {
    setUnlockedPin(pendingPin);
    saveImage(pendingPin, recoveryCode);
    setRecoveryCode(null);
    setPendingPin(null);
  };

  const removeImage = () => {
    setImageData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className="image-uploader-overlay" onClick={onClose}>
        <div className="image-uploader" onClick={e => e.stopPropagation()}>
          {isSaving && (
            <div className="image-uploader-saving-overlay">
              <div className="image-uploader-saving-spinner"></div>
              <p className="image-uploader-saving-text">Encrypting & Saving Image...</p>
              <p className="image-uploader-saving-subtext">This may take a moment for larger images</p>
            </div>
          )}
          <div className="image-uploader-header">
            <h2 className="image-uploader-title">🖼️ Add Image</h2>
            <button 
              className="image-uploader-close" 
              onClick={onClose} 
              aria-label="Close"
              disabled={isSaving}
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="image-uploader-loading">
              <div className="image-uploader-loading-spinner"></div>
              <p className="image-uploader-loading-text">Loading Image... {readProgress}%</p>
              <div className="image-uploader-loading-bar">
                <div 
                  className="image-uploader-loading-bar-fill" 
                  style={{ width: `${readProgress}%` }}
                ></div>
              </div>
            </div>
          ) : !imageData ? (
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                id="image-file-input"
                disabled={isSaving}
              />
              <span className="drop-zone-icon">📸</span>
              <p className="drop-zone-text">Drop image here or click to browse</p>
              <p className="drop-zone-subtext">Supports JPG, PNG, WebP (max 5MB)</p>
            </div>
          ) : (
            <div className="image-preview-container">
              <img
                src={imageData.data}
                alt="Preview"
                className="image-preview"
              />
              <button 
                className="image-preview-remove" 
                onClick={removeImage} 
                aria-label="Remove image"
                disabled={isSaving}
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>
              ⚠️ {error}
            </p>
          )}

          {imageData && (
            <form className="image-uploader-form" onSubmit={handleSubmit}>
              <div className="field-group">
                <label htmlFor="image-title">Title</label>
                <input
                  id="image-title"
                  className="input"
                  type="text"
                  placeholder="Give your image a title..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isSaving}
                />
              </div>

              {imageData.size > 2 * 1024 * 1024 && (
                <p className="image-size-warning">
                  ⚠️ Large image ({formatFileSize(imageData.size)}) — may use significant storage
                </p>
              )}

              <div className="note-editor-protection">
                <label htmlFor="image-protection">
                  🙈 Hide this image
                </label>
                <div className="toggle-switch">
                  <input
                    id="image-protection"
                    type="checkbox"
                    checked={isProtected}
                    onChange={() => !isSaving && setIsProtected(!isProtected)}
                    disabled={isSaving}
                  />
                  <span 
                    className="toggle-slider" 
                    onClick={() => !isSaving && setIsProtected(!isProtected)}
                  ></span>
                </div>
              </div>

              <div className="image-uploader-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Image'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showPinModal && (
        <PinModal
          mode={profile?.pin_hash ? 'verify' : 'set'}
          onSubmit={handlePinSubmit}
          onClose={() => setShowPinModal(false)}
          error={pinError}
        />
      )}

      {recoveryCode && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" style={{ maxWidth: '460px', textAlign: 'center', padding: 'var(--space-xl)' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🔑</span>
            <h2 className="modal-title" style={{ marginBottom: 'var(--space-sm)' }}>Your Recovery Code</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              If you forget your PIN, you will need this Recovery Code to restore access to your protected notes.
            </p>
            <p style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
              WARNING: We do not store this recovery code on our servers. Write it down or save it somewhere secure.
            </p>
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px dashed var(--border-color-strong)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              fontFamily: 'monospace',
              fontSize: '1.4rem',
              fontWeight: 'bold',
              letterSpacing: '1px',
              color: 'var(--accent-primary)',
              marginBottom: 'var(--space-xl)',
              userSelect: 'all'
            }}>
              {recoveryCode}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleConfirmRecoveryCode}
            >
              I have saved the Recovery Code
            </button>
          </div>
        </div>
      )}
    </>
  );
}
