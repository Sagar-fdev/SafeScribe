import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnimatedBackground from '../components/3d/AnimatedBackground';
import ThemeToggle from '../components/ThemeToggle';
import './Login.css';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google Sign-In Failed');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await register(username, password);
        setSuccessMessage('Verification email sent. Please check your inbox and click the confirmation link.');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
      } else {
        await login(username, password);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-page">
      <AnimatedBackground />

      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-privacy-badge">
            Your Privacy Is My Priority
          </div>

          <div className="login-header">
            <span className="login-logo">📒</span>
            <h1 className="login-title">
              <span className="gradient-text">SafeScribe</span>
            </h1>
            <p className="login-subtitle">
              {isRegister ? 'Create your account to get started' : 'Welcome back! Sign in to your notes'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {successMessage && <div className="login-success">{successMessage}</div>}
            {error && <div className="login-error">⚠️ {error}</div>}

            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                className="input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {isRegister && (
              <div className="login-field" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                <label htmlFor="login-confirm-password">Confirm Password</label>
                <input
                  id="login-confirm-password"
                  className="input"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg login-submit"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? '⏳ Please wait...' : (isRegister ? '🚀 Create Account' : '🔑 Sign In')}
            </button>
          </form>

          <div className="login-divider">or</div>

          <button
            type="button"
            className="btn-google"
            onClick={handleGoogleSignIn}
            style={{ width: '100%' }}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="login-toggle">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={toggleMode}>
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>
        </div>
      </div>

      <footer className="login-footer">
        Built by Sagar Kumar Singh
      </footer>
    </div>
  );
}
