import { useState } from 'react';
import './GoogleSignIn.css';

const ACCOUNTS = [
  {
    name: 'John Doe',
    email: 'john.doe@gmail.com',
    photoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%234285F4"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">J</text></svg>'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@gmail.com',
    photoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23EA4335"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">J</text></svg>'
  },
  {
    name: 'Guest User',
    email: 'guest.user@gmail.com',
    photoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%2334A853"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">G</text></svg>'
  }
];

export default function GoogleSignIn() {
  const [showCustom, setShowCustom] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSelectAccount = (accountName, accountEmail, photoUrl) => {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'GOOGLE_SIGNIN_SUCCESS',
          name: accountName,
          email: accountEmail,
          photoUrl
        },
        window.location.origin
      );
      window.close();
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const initial = name.trim().charAt(0).toUpperCase();
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const photoUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${encodeURIComponent(randomColor)}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="18" font-weight="bold">${initial}</text></svg>`;

    handleSelectAccount(name.trim(), email.trim(), photoUrl);
  };

  return (
    <div className="gsi-container">
      <div className="gsi-card">
        {/* Google Logo */}
        <div className="gsi-logo-wrapper">
          <svg className="gsi-logo" viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
        </div>

        <h1 className="gsi-title">Sign in with Google</h1>
        <p className="gsi-subtitle">to continue to <span style={{ fontWeight: 600 }}>SafeScribe</span></p>

        {!showCustom ? (
          <div className="gsi-accounts-list animate-fade">
            {ACCOUNTS.map((account) => (
              <button
                key={account.email}
                className="gsi-account-row"
                onClick={() => handleSelectAccount(account.name, account.email, account.photoUrl)}
              >
                <img src={account.photoUrl} alt={account.name} className="gsi-avatar" />
                <div className="gsi-account-info">
                  <div className="gsi-account-name">{account.name}</div>
                  <div className="gsi-account-email">{account.email}</div>
                </div>
              </button>
            ))}

            <button className="gsi-another-account-btn" onClick={() => setShowCustom(true)}>
              <span className="gsi-another-icon">👤</span>
              <span>Use another account</span>
            </button>
          </div>
        ) : (
          <form className="gsi-form animate-fade" onSubmit={handleCustomSubmit}>
            <div className="gsi-form-group">
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="gsi-input"
                autoFocus
              />
            </div>
            <div className="gsi-form-group">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="gsi-input"
              />
            </div>
            
            <div className="gsi-form-actions">
              <button type="button" className="gsi-btn-secondary" onClick={() => setShowCustom(false)}>
                Back
              </button>
              <button type="submit" className="gsi-btn-primary">
                Next
              </button>
            </div>
          </form>
        )}

        <div className="gsi-footer">
          To continue, Google will share your name, email address, profile picture, and language preference with SafeScribe.
        </div>
      </div>
    </div>
  );
}
