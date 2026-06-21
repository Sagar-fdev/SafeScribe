import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { NotesProvider } from './context/NotesContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GoogleSignIn from './pages/GoogleSignIn';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        gap: 'var(--space-md)'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid var(--border-color)',
          borderTop: '3px solid var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div className="gradient-text" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
          SafeScribe
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/google-signin" element={<GoogleSignIn />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <NotesProvider>
              <Dashboard />
            </NotesProvider>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
