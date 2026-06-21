import { useState, useRef, useEffect } from 'react';
import './PinModal.css';

export default function PinModal({ mode = 'verify', onSubmit, onClose, onForgotPin, error: externalError, description, expectedLength = 4 }) {
  const [pinLength, setPinLength] = useState(expectedLength);
  const [pin, setPin] = useState(Array(expectedLength).fill(''));
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    setPin(Array(pinLength).fill(''));
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
  }, [pinLength]);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
      triggerShake();
    }
  }, [externalError]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    setPin(Array(pinLength).fill(''));
    inputRefs.current[0]?.focus();
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    if (value && index < pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (value && index === pinLength - 1) {
      const fullPin = newPin.join('');
      if (fullPin.length === pinLength) {
        onSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSubmit = () => {
    const fullPin = pin.join('');
    if (fullPin.length < pinLength) {
      setError(`Please enter a ${pinLength}-digit PIN`);
      return;
    }
    onSubmit(fullPin);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`pin-modal ${shaking ? 'shake' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal" style={{ maxWidth: '380px' }}>
          <span className="pin-lock-icon">🔐</span>
          <h2 className="modal-title" style={{ marginBottom: '8px', textAlign: 'center' }}>
            {mode === 'set' ? 'Set Hidden PIN' : 'Enter PIN'}
          </h2>
          <p className="pin-modal-description" style={{ textAlign: 'center' }}>
            {description || (mode === 'set'
              ? 'Create a 4-digit or 6-digit PIN to hide this note'
              : 'Enter the PIN to reveal this note')}
          </p>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderColor: pinLength === 4 ? 'var(--accent-primary)' : 'var(--border-color)',
                background: pinLength === 4 ? 'var(--accent-soft)' : 'transparent',
                color: pinLength === 4 ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setPinLength(4)}
            >
              4 Digits
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderColor: pinLength === 6 ? 'var(--accent-primary)' : 'var(--border-color)',
                background: pinLength === 6 ? 'var(--accent-soft)' : 'transparent',
                color: pinLength === 6 ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setPinLength(6)}
            >
              6 Digits
            </button>
          </div>

          <div className="pin-input-group" style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                id={`pin-digit-${index}`}
                type="password"
                inputMode="numeric"
                maxLength={1}
                className={`pin-digit ${digit ? 'filled' : ''}`}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                autoComplete="off"
                style={{ width: pinLength === 6 ? '38px' : '48px', height: pinLength === 6 ? '46px' : '56px' }}
              />
            ))}
          </div>

          <div className="pin-error" style={{ textAlign: 'center' }}>{error}</div>

          <div className="pin-actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {mode === 'set' ? 'Set PIN' : 'Unlock'}
            </button>
          </div>

          {mode === 'verify' && onForgotPin && (
            <div style={{ marginTop: '16px', fontSize: '0.85rem', textAlign: 'center' }}>
              <button
                type="button"
                className="otp-resend-btn"
                style={{ textDecoration: 'underline' }}
                onClick={() => {
                  onClose();
                  onForgotPin();
                }}
              >
                Forgot PIN? Use Recovery Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
