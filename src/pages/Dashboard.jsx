import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotes } from '../context/NotesContext';
import AnimatedBackground from '../components/3d/AnimatedBackground';
import ThemeToggle from '../components/ThemeToggle';
import NoteEditor from '../components/NoteEditor';
import ImageUploader from '../components/ImageUploader';
import PinModal from '../components/PinModal';
import { comparePin, decryptPinWithRecoveryCode, generateRecoveryCode, decryptNote } from '../lib/crypto';
import './Dashboard.css';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const {
    notes,
    deleteNote,
    toggleProtection,
    updateNote,
    unlockedPin,
    setUnlockedPin,
    profile,
    recoverPin,
    changePin
  } = useNotes();

  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showHiddenNotes, setShowHiddenNotes] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveredPin, setRecoveredPin] = useState(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [newPinVal, setNewPinVal] = useState('');
  const [resettingPin, setResettingPin] = useState(false);

  // Change PIN states
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changePinRecoveryCode, setChangePinRecoveryCode] = useState('');
  const [changePinNewPin, setChangePinNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  const deleteTimeoutRef = useRef(null);

  const isSessionUnlocked = !!unlockedPin;

  // Clear delete confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Close mobile menu on click outside
  useEffect(() => {
    if (!showMobileMenu) return;

    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dashboard-header')) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showMobileMenu]);

  const getNoteContent = (note) => {
    return note?.decryptedContent || '';
  };

  // Pin verification state
  const [pinAction, setPinAction] = useState(null);
  const [pinError, setPinError] = useState('');

  // Filter notes by search and hidden status
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (!showHiddenNotes) {
      result = result.filter(note => !note.isProtected);
    }
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(note =>
      (note.decryptedTitle || '').toLowerCase().includes(q) ||
      (note.type === 'text' && getNoteContent(note).toLowerCase().includes(q))
    );
  }, [notes, searchQuery, showHiddenNotes]);

  // Handle clicking a note card
  const handleNoteClick = (note) => {
    if (note.isProtected && !isSessionUnlocked) {
      setPinAction({ type: 'view', noteId: note.id });
      setPinError('');
    } else {
      setViewingNote(note);
    }
  };

  // Handle edit button
  const handleEdit = (e, note) => {
    e.stopPropagation();
    e.preventDefault();
    if (note.isProtected && !isSessionUnlocked) {
      setPinAction({ type: 'edit', noteId: note.id });
      setPinError('');
    } else {
      setEditingNote(note);
      setShowNoteEditor(true);
    }
  };

  // Handle delete button
  const handleDelete = (e, note) => {
    e.stopPropagation();
    e.preventDefault();

    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }

    if (note.isProtected && !isSessionUnlocked) {
      setPinAction({ type: 'delete', noteId: note.id });
      setPinError('');
    } else {
      if (confirmDeleteId === note.id) {
        deleteNote(note.id);
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(note.id);
        deleteTimeoutRef.current = setTimeout(() => {
          setConfirmDeleteId(null);
        }, 3000);
      }
    }
  };

  // Handle hide/unhide toggle
  const handleToggleProtection = (e, note) => {
    e.stopPropagation();
    e.preventDefault();
    if (note.decryptedTitle === 'Error Decrypting') {
      alert('Cannot change protection status: Decryption failed for this note. Please verify your authentication state or credentials.');
      return;
    }
    if (note.isProtected) {
      if (isSessionUnlocked) {
        toggleProtection(note.id, false, null, null, note.decryptedTitle, note.decryptedContent);
      } else {
        setPinAction({ type: 'unprotect', noteId: note.id });
        setPinError('');
      }
    } else {
      if (isSessionUnlocked) {
        toggleProtection(note.id, true, unlockedPin, null, note.decryptedTitle, note.decryptedContent);
      } else {
        setPinAction({ type: 'protect', noteId: note.id });
        setPinError('');
      }
    }
  };

  // Handle top bar click to reveal/hide hidden notes
  const handleTopbarHideClick = () => {
    if (showHiddenNotes) {
      setShowHiddenNotes(false);
      setUnlockedPin(null);
    } else {
      const hasProtectedNotes = notes.some(n => n.isProtected);
      if (hasProtectedNotes) {
        if (isSessionUnlocked) {
          setShowHiddenNotes(true);
        } else {
          setPinAction({ type: 'unlock_session' });
          setPinError('');
        }
      } else {
        setShowHiddenNotes(true);
      }
    }
  };

  // Handle PIN submission
  const handlePinSubmit = async (pin) => {
    const hasExistingProtectedNotes = !!profile?.pin_hash;

    if (pinAction.type === 'unlock_session') {
      if (profile?.pin_hash && comparePin(pin, profile.pin_hash)) {
        setUnlockedPin(pin);
        setShowHiddenNotes(true);
        setPinAction(null);
        setPinError('');
      } else {
        setPinError('Incorrect PIN. Try again.');
      }
      return;
    }

    const note = notes.find(n => n.id === pinAction.noteId);
    if (!note) return;

    if (pinAction.type === 'protect') {
      if (hasExistingProtectedNotes) {
        if (profile?.pin_hash && comparePin(pin, profile.pin_hash)) {
          setUnlockedPin(pin);
          setShowHiddenNotes(true);
          await toggleProtection(note.id, true, pin, null, note.decryptedTitle, note.decryptedContent);
          setPinAction(null);
          setPinError('');
        } else {
          setPinError('Incorrect PIN. Try again.');
        }
      } else {
        const code = generateRecoveryCode();
        setPendingPin(pin);
        setNewRecoveryCode(code);
      }
      return;
    }

    if (profile?.pin_hash && comparePin(pin, profile.pin_hash)) {
      setUnlockedPin(pin);
      setShowHiddenNotes(true);

      switch (pinAction.type) {
        case 'view':
          setViewingNote(note);
          break;
        case 'edit':
          if (note.type === 'text') {
            setEditingNote(note);
            setShowNoteEditor(true);
          }
          break;
        case 'delete':
          await deleteNote(note.id);
          break;
        case 'unprotect':
          try {
            let decryptedTitle = note.title || 'Untitled';
            let decryptedContent = '';
            if (note.encryptedTitle || note.encryptedContent) {
              const decrypted = await decryptNote(
                note.encryptedTitle,
                note.encryptedContent,
                note.salt,
                note.iv,
                pin
              );
              decryptedTitle = decrypted.title;
              decryptedContent = decrypted.content;
            } else if (note.encryptedContent) {
              const decrypted = await decryptNote(
                null,
                note.encryptedContent,
                note.salt,
                note.iv,
                pin
              );
              decryptedContent = decrypted.content;
            }
            await toggleProtection(note.id, false, null, null, decryptedTitle, decryptedContent);
          } catch (err) {
            console.error('Failed to decrypt note for unprotect:', err);
            alert('Failed to decrypt the note. Unprotect aborted to prevent data loss.');
          }
          break;
      }
      setPinAction(null);
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Try again.');
    }
  };

  const handleConfirmNewRecoveryCode = async () => {
    setUnlockedPin(pendingPin);

    if (pinAction && pinAction.type === 'protect') {
      const note = notes.find(n => n.id === pinAction.noteId);
      if (note) {
        await toggleProtection(note.id, true, pendingPin, newRecoveryCode, note.decryptedTitle, note.decryptedContent);
      }
    }

    setNewRecoveryCode(null);
    setPendingPin(null);
    setPinAction(null);
    setShowHiddenNotes(true);
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryError('');

    const formattedCode = recoveryCode.trim().toUpperCase();
    if (!formattedCode) return;

    try {
      const pin = await recoverPin(formattedCode);

      setRecoveredPin(pin);
      setUnlockedPin(pin);
      setShowHiddenNotes(true);
    } catch (err) {
      console.error('Recovery failed:', err);
      setRecoveryError(err.message || 'Invalid Recovery Code. Please verify and try again.');
    }
  };

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setChangePinError('');

    const formattedCode = changePinRecoveryCode.trim().toUpperCase();
    if (!formattedCode) {
      setChangePinError('Recovery code is required.');
      return;
    }

    if (changePinNewPin.length !== 4 && changePinNewPin.length !== 6) {
      setChangePinError('New PIN must be 4 or 6 digits.');
      return;
    }

    setChangingPin(true);
    try {
      await changePin(formattedCode, changePinNewPin);
      setChangePinSuccess(true);
      setChangePinRecoveryCode('');
      setChangePinNewPin('');
    } catch (err) {
      console.error('Change PIN failed:', err);
      setChangePinError(err.message || 'Failed to change PIN. Please try again.');
    } finally {
      setChangingPin(false);
    }
  };

  const getEditingNote = () => {
    return editingNote;
  };

  const getViewingNote = () => {
    return viewingNote;
  };

  return (
    <div className="dashboard">
      <AnimatedBackground />

      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="dashboard-brand">
            <span className="dashboard-brand-icon">📒</span>
            <span className="dashboard-brand-name gradient-text">SafeScribe</span>
          </div>

          {/* Desktop Navigation */}
          <div className="dashboard-header-right desktop-only">
            {profile?.pin_hash && (
              <button
                id="change-pin-btn"
                className="dashboard-toggle-hidden-btn"
                onClick={() => setShowChangePinModal(true)}
                title="Change PIN"
              >
                <span>🔑</span>
                <span>Change PIN</span>
              </button>
            )}
            <button
              id="hide-topbar-btn"
              className={`dashboard-toggle-hidden-btn ${showHiddenNotes ? 'active' : ''}`}
              onClick={handleTopbarHideClick}
              title={showHiddenNotes ? 'Hide hidden notes' : 'Reveal hidden notes'}
            >
              <span>{showHiddenNotes ? '👁️' : '🙈'}</span>
              <span>{showHiddenNotes ? 'Hide' : 'Reveal'}</span>
            </button>
            <ThemeToggle />
            <div className="dashboard-user">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.displayName} className="dashboard-user-avatar" />
              ) : (
                <span className="dashboard-user-icon">👤</span>
              )}
              <span>{user?.displayName}</span>
            </div>
            <button className="dashboard-logout" onClick={logout} id="logout-btn">
              Logout
            </button>
          </div>

          {/* Mobile Navigation Trigger */}
          <div className="mobile-only">
            <button
              id="mobile-menu-toggle"
              className={`mobile-menu-toggle-btn ${showMobileMenu ? 'active' : ''}`}
              onClick={() => setShowMobileMenu(prev => !prev)}
              aria-label="Toggle menu"
              title="Menu"
            >
              <span>{showMobileMenu ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {showMobileMenu && (
          <div className="mobile-dropdown-menu">
            <div className="mobile-dropdown-item user-info">
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt={user.displayName} className="dashboard-user-avatar" />
              ) : (
                <span className="dashboard-user-icon">👤</span>
              )}
              <span>{user?.displayName}</span>
            </div>
            <div className="mobile-dropdown-item">
              <span className="mobile-dropdown-label">Theme Mode:</span>
              <ThemeToggle />
            </div>
            <div className="mobile-dropdown-item">
              <span className="mobile-dropdown-label">Hidden Notes:</span>
              <button
                id="hide-mobile-btn"
                className={`dashboard-toggle-hidden-btn ${showHiddenNotes ? 'active' : ''}`}
                onClick={() => {
                  handleTopbarHideClick();
                  setShowMobileMenu(false);
                }}
              >
                <span>{showHiddenNotes ? '👁️' : '🙈'}</span>
                <span>{showHiddenNotes ? 'Hide' : 'Reveal'}</span>
              </button>
            </div>
            {profile?.pin_hash && (
              <div className="mobile-dropdown-item">
                <span className="mobile-dropdown-label">Security:</span>
                <button
                  id="change-pin-mobile-btn"
                  className="dashboard-toggle-hidden-btn"
                  onClick={() => {
                    setShowChangePinModal(true);
                    setShowMobileMenu(false);
                  }}
                >
                  <span>🔑</span>
                  <span>Change PIN</span>
                </button>
              </div>
            )}
            <div className="mobile-dropdown-item logout-container">
              <button className="dashboard-logout" onClick={logout} id="logout-mobile-btn">
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="dashboard-content">
        {/* Toolbar */}
        <div className="dashboard-toolbar">
          <div className="dashboard-search">
            <span className="dashboard-search-icon">🔍</span>
            <input
              id="search-notes"
              className="input"
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {notes.length > 0 && (
            <div className="dashboard-actions">
              <button
                id="add-note-btn"
                className="btn btn-primary"
                onClick={() => { setEditingNote(null); setShowNoteEditor(true); }}
              >
                📝 Write Note
              </button>
              <button
                id="add-image-btn"
                className="btn btn-secondary"
                onClick={() => setShowImageUploader(true)}
              >
                🖼️ Add Image
              </button>
            </div>
          )}
        </div>

        {/* Notes Grid */}
        {filteredNotes.length > 0 ? (
          <div className="notes-grid">
            {filteredNotes.map((note, index) => (
              <div
                key={note.id}
                className={`note-card ${note.isProtected ? 'note-card-protected' : ''}`}
                onClick={() => handleNoteClick(note)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Lock overlay for hidden notes */}
                {note.isProtected && !isSessionUnlocked && (
                  <div className="note-card-lock-overlay">
                    <span className="note-card-lock-icon">👁️‍🗨️</span>
                    <span className="note-card-lock-text">Hidden • Click to reveal</span>
                  </div>
                )}

                {/* Image preview */}
                {note.type === 'image' && (!note.isProtected || isSessionUnlocked) && (
                  <img
                    src={getNoteContent(note)}
                    alt={note.decryptedTitle}
                    className="note-card-image"
                    loading="lazy"
                  />
                )}

                {/* Card body */}
                <div className="note-card-body">
                  <h3 className="note-card-title">
                    <span className="note-card-title-icon">
                      {note.type === 'image' ? '🖼️' : '📝'}
                    </span>
                    {note.decryptedTitle}
                  </h3>
                  {note.type === 'text' && (!note.isProtected || isSessionUnlocked) && (
                    <p className="note-card-content">{getNoteContent(note)}</p>
                  )}
                  {note.isProtected && !isSessionUnlocked && (
                    <p className="note-card-content" style={{ fontStyle: 'italic', opacity: 0.5 }}>
                      Content is hidden
                    </p>
                  )}
                </div>

                {/* Card footer */}
                <div className="note-card-footer">
                  <span className="note-card-date">{formatDate(note.createdAt)}</span>
                  <div className="note-card-actions">
                    <button
                      className="note-card-action protect"
                      onClick={e => handleToggleProtection(e, note)}
                      title={note.isProtected ? 'Unhide note' : 'Hide note'}
                    >
                      {note.isProtected ? '👁️' : '🙈'}
                    </button>
                    {note.type === 'text' && (
                      <button
                        className="note-card-action"
                        onClick={e => handleEdit(e, note)}
                        title="Edit note"
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      className={`note-card-action delete ${confirmDeleteId === note.id ? 'confirm-delete' : ''}`}
                      onClick={e => handleDelete(e, note)}
                      title={confirmDeleteId === note.id ? 'Click again to confirm delete' : 'Delete note'}
                    >
                      {confirmDeleteId === note.id ? 'Confirm' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon">
              {searchQuery ? '🔍' : '✨'}
            </span>
            <h2 className="empty-state-title">
              {searchQuery ? 'No notes found' : ''}
            </h2>
            <p className="empty-state-text">
              {searchQuery
                ? `No notes matching "${searchQuery}"`
                : notes.some(n => n.isProtected)
                  ? 'All notes are currently hidden. Click the Hide button in the top bar to reveal them!'
                  : 'Create your first note or add an image to get started!'}
            </p>
            {!searchQuery && (
              <div className="empty-state-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => { setEditingNote(null); setShowNoteEditor(true); }}
                >
                  📝 Write Note
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowImageUploader(true)}
                >
                  🖼️ Add Image
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Note Editor Modal */}
      {showNoteEditor && (
        <NoteEditor
          note={getEditingNote()}
          onClose={() => { setShowNoteEditor(false); setEditingNote(null); }}
        />
      )}

      {/* Image Uploader Modal */}
      {showImageUploader && (
        <ImageUploader
          onClose={() => setShowImageUploader(false)}
        />
      )}

      {/* Note Detail Modal */}
      {viewingNote && (
        <div className="note-detail-overlay" onClick={() => setViewingNote(null)}>
          <div className="note-detail" onClick={e => e.stopPropagation()}>
            <div className="note-detail-header">
              <h2 className="note-detail-title">
                <span>{viewingNote.type === 'image' ? '🖼️' : '📝'}</span>
                {viewingNote.decryptedTitle}
              </h2>
              <button
                className="note-detail-close"
                onClick={() => setViewingNote(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="note-detail-body">
              {viewingNote.type === 'text' ? (
                <p className="note-detail-content">{getNoteContent(viewingNote)}</p>
              ) : (
                <img
                  src={getNoteContent(viewingNote)}
                  alt={viewingNote.decryptedTitle}
                  className="note-detail-image"
                />
              )}
            </div>
            <div className="note-detail-meta">
              <span>Created {formatDate(viewingNote.createdAt)}</span>
              <div className="note-detail-actions">
                {viewingNote.type === 'text' && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const noteToEdit = getViewingNote();
                      setViewingNote(null);
                      setEditingNote(noteToEdit);
                      setShowNoteEditor(true);
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => {
                    deleteNote(viewingNote.id);
                    setViewingNote(null);
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {pinAction && (
        <PinModal
          mode={pinAction.type === 'protect' && !profile?.pin_hash ? 'set' : 'verify'}
          onSubmit={handlePinSubmit}
          onClose={() => { setPinAction(null); setPinError(''); }}
          error={pinError}
          onForgotPin={() => {
            setPinAction(null);
            setShowRecoveryModal(true);
          }}
          description={
            pinAction.type === 'unlock_session'
              ? 'Enter PIN to reveal all hidden notes'
              : undefined
          }
          expectedLength={localStorage.getItem('safescribe_pin_length') ? parseInt(localStorage.getItem('safescribe_pin_length'), 10) : 4}
        />
      )}

      {/* Recovery Code Input Modal */}
      {showRecoveryModal && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🛡️</span>
            <h2 className="modal-title" style={{ marginBottom: '8px' }}>PIN Recovery</h2>
            <p className="otp-modal-description" style={{ marginBottom: '16px' }}>
              Enter your 16-character Recovery Code to unlock your session and recover your notes.
            </p>

            <form onSubmit={handleRecoverySubmit}>
              <div className="field-group" style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value)}
                  style={{ textAlign: 'center', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 'bold' }}
                  required
                  autoFocus
                />
              </div>

              {recoveryError && <div className="pin-error" style={{ color: 'var(--danger)', marginBottom: '16px' }}>⚠️ {recoveryError}</div>}

              <div className="pin-actions" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowRecoveryModal(false); setRecoveryCode(''); setRecoveryError(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Recover Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Success Modal */}
      {recoveredPin && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🔓</span>
            <h2 className="modal-title" style={{ marginBottom: '8px' }}>Recovery Successful</h2>
            <p className="otp-modal-description" style={{ marginBottom: '16px' }}>
              Your notes are now unlocked. Your current PIN is: <strong style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }}>{recoveredPin}</strong>
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Write down your PIN or change it using the "Change PIN" option.
            </p>

            <div className="pin-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => { setRecoveredPin(null); setShowRecoveryModal(false); setRecoveryCode(''); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Recovery Code Modal after PIN Reset (Not used in simplified recovery flow, but kept for first-time set config) */}
      {newRecoveryCode && !pendingPin && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', textAlign: 'center', padding: 'var(--space-xl)' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🔑</span>
            <h2 className="modal-title" style={{ marginBottom: 'var(--space-sm)' }}>New Recovery Code</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Your PIN has been successfully reset! Here is your new Recovery Code:
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
              {newRecoveryCode}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                setNewRecoveryCode(null);
                setShowRecoveryModal(false);
                setRecoveryCode('');
              }}
            >
              I have saved the New Code
            </button>
          </div>
        </div>
      )}

      {/* Setup First PIN Recovery Code Confirm Modal */}
      {newRecoveryCode && pendingPin && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', textAlign: 'center', padding: 'var(--space-xl)' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🔑</span>
            <h2 className="modal-title" style={{ marginBottom: 'var(--space-sm)' }}>Your Recovery Code</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Save this Recovery Code safely. If you forget your PIN, you will need this code to recover your notes.
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
              {newRecoveryCode}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleConfirmNewRecoveryCode}
            >
              I have saved the Recovery Code
            </button>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="overlay" style={{ zIndex: 'var(--z-toast)' }}>
          <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', display: 'block' }}>🔑</span>
            <h2 className="modal-title" style={{ marginBottom: '8px' }}>Change PIN</h2>

            {changePinSuccess ? (
              <>
                <p className="otp-modal-description" style={{ color: 'var(--success)', fontWeight: 'bold', marginBottom: '24px' }}>
                  ✓ PIN changed and notes re-encrypted successfully!
                </p>
                <div className="pin-actions" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowChangePinModal(false);
                      setChangePinSuccess(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleChangePinSubmit}>
                <p className="otp-modal-description" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                  Enter your existing Recovery Code and enter a new 4 or 6 digit PIN.
                </p>

                <div className="field-group" style={{ marginBottom: '16px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>Recovery Code</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    value={changePinRecoveryCode}
                    onChange={e => setChangePinRecoveryCode(e.target.value)}
                    style={{ textAlign: 'center', fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 'bold' }}
                    required
                  />
                </div>

                <div className="field-group" style={{ marginBottom: '24px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block', color: 'var(--text-secondary)' }}>New PIN (4 or 6 digits)</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••"
                    value={changePinNewPin}
                    onChange={e => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) setChangePinNewPin(val);
                    }}
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '5px' }}
                    required
                  />
                </div>

                {changePinError && <div className="pin-error" style={{ color: 'var(--danger)', marginBottom: '16px' }}>⚠️ {changePinError}</div>}

                <div className="pin-actions" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowChangePinModal(false);
                      setChangePinRecoveryCode('');
                      setChangePinNewPin('');
                      setChangePinError('');
                    }}
                    disabled={changingPin}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={changingPin}>
                    {changingPin ? 'Updating...' : 'Change PIN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        Built by Sagar Kumar Singh
      </footer>
    </div>
  );
}
