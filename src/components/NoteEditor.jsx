import { useState } from 'react';
import { useNotes } from '../context/NotesContext';
import PinModal from './PinModal';
import { generateRecoveryCode, comparePin } from '../lib/crypto';
import './NoteEditor.css';

export default function NoteEditor({ note, onClose }) {
  const { notes, addNote, updateNote, unlockedPin, setUnlockedPin, profile } = useNotes();
  const [title, setTitle] = useState(note?.decryptedTitle || '');
  const [content, setContent] = useState(note?.decryptedContent || '');
  const [isProtected, setIsProtected] = useState(note?.isProtected || false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalMode, setPinModalMode] = useState('set');
  const [pinError, setPinError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);

  const isEditing = !!note;

  const hasExistingProtectedNotes = !!profile?.pin_hash;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !title.trim()) return;

    const noteData = {
      type: 'text',
      decryptedTitle: title.trim() || 'Untitled Note',
      decryptedContent: content.trim(),
      isProtected,
    };

    try {
      if (isProtected) {
        if (unlockedPin) {
          if (isEditing) {
            await updateNote(note.id, noteData, unlockedPin);
          } else {
            await addNote(noteData, unlockedPin);
          }
          onClose();
        } else {
          setPinError('');
          if (hasExistingProtectedNotes) {
            setPinModalMode('verify');
          } else {
            setPinModalMode('set');
          }
          setShowPinModal(true);
        }
      } else {
        if (isEditing) {
          await updateNote(note.id, noteData);
        } else {
          await addNote(noteData);
        }
        onClose();
      }
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const handleProtectionToggle = () => {
    if (!isProtected) {
      if (unlockedPin) {
        setIsProtected(true);
      } else {
        setPinError('');
        if (hasExistingProtectedNotes) {
          setPinModalMode('verify');
        } else {
          setPinModalMode('set');
        }
        setShowPinModal(true);
      }
    } else {
      setIsProtected(false);
    }
  };

  const handlePinSubmit = async (pin) => {
    if (pinModalMode === 'verify') {
      if (profile?.pin_hash && comparePin(pin, profile.pin_hash)) {
        setUnlockedPin(pin);
        setIsProtected(true);
        setShowPinModal(false);

        const noteData = {
          type: 'text',
          decryptedTitle: title.trim() || 'Untitled Note',
          decryptedContent: content.trim(),
          isProtected: true,
        };

        if (isEditing) {
          await updateNote(note.id, noteData, pin);
        } else {
          await addNote(noteData, pin);
        }
        onClose();
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

  const handleConfirmRecoveryCode = async () => {
    const noteData = {
      type: 'text',
      decryptedTitle: title.trim() || 'Untitled Note',
      decryptedContent: content.trim(),
      isProtected: true,
    };

    setUnlockedPin(pendingPin);
    setIsProtected(true);

    if (isEditing) {
      await updateNote(note.id, noteData, pendingPin, recoveryCode);
    } else {
      await addNote(noteData, pendingPin, recoveryCode);
    }

    setRecoveryCode(null);
    setPendingPin(null);
    onClose();
  };

  return (
    <>
      <div className="note-editor-overlay" onClick={onClose}>
        <div className="note-editor" onClick={e => e.stopPropagation()}>
          <div className="note-editor-header">
            <h2 className="note-editor-title">
              {isEditing ? '✏️ Edit Note' : '📝 New Note'}
            </h2>
            <button className="note-editor-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <form className="note-editor-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="note-title">Title</label>
              <input
                id="note-title"
                className="input"
                type="text"
                placeholder="Give your note a title..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field-group">
              <label htmlFor="note-content">Content</label>
              <textarea
                id="note-content"
                className="input"
                placeholder="Write your thoughts..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={6}
              />
            </div>

            <div className="note-editor-protection">
              <label htmlFor="note-protection">
                🙈 Hide this note
              </label>
              <div className="toggle-switch">
                <input
                  id="note-protection"
                  type="checkbox"
                  checked={isProtected}
                  onChange={handleProtectionToggle}
                />
                <span className="toggle-slider" onClick={handleProtectionToggle}></span>
              </div>
            </div>

            <div className="note-editor-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {isEditing ? 'Save Changes' : 'Create Note'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showPinModal && (
        <PinModal
          mode={pinModalMode}
          onSubmit={handlePinSubmit}
          onClose={() => {
            setShowPinModal(false);
          }}
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
