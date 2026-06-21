import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

//async function hashPassword(password) {
/*const encoder = new TextEncoder();
const data = encoder.encode(password);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');*/
//}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hasAuthParams = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      return (
        hash.includes('access_token=') ||
        hash.includes('id_token=') ||
        hash.includes('error=') ||
        search.includes('code=')
      );
    };

    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email,
            photoUrl: session.user.user_metadata?.avatar_url,
          });
          setLoading(false);
        } else {
          // If we have auth parameters in URL, we are currently parsing them
          // to set a session. In this case, keep loading = true and let 
          // onAuthStateChange handle the transition.
          if (!hasAuthParams()) {
            setUser(null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error getting initial session:', err);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          displayName:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email,
          photoUrl: session.user.user_metadata?.avatar_url,
        });
        setLoading(false);
      } else {
        setUser(null);
        // Only stop loading if we aren't waiting for URL hash processing
        if (!hasAuthParams()) {
          setLoading(false);
        }
      }
    });

    // Safety timeout: if we have auth params but the redirect/parsing fails or hangs,
    // ensure loading goes to false after 5 seconds to prevent black screens.
    let timeoutId;
    if (hasAuthParams()) {
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Google auth redirect callback timeout reached. Setting loading to false.');
          setLoading(false);
        }
      }, 5000);
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const register = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }, []);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
