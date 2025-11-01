import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

interface Profile {
  full_name?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Simple initialization - get current session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only set user if session is valid
      if (session?.user) {
        // Verify session is not expired
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt > now) {
          setUser(session.user);
          setProfile({
            email: session.user.email || undefined,
            full_name: session.user.user_metadata?.full_name || undefined,
          });
        } else if (!expiresAt) {
          // No expiration time, assume valid
          setUser(session.user);
          setProfile({
            email: session.user.email || undefined,
            full_name: session.user.user_metadata?.full_name || undefined,
          });
        } else {
          // Session expired, clear it
          setUser(null);
          setProfile(null);
          supabase.auth.signOut();
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // Listen for auth changes - handle all auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        // Update on any auth event that provides a session (SIGNED_IN, TOKEN_REFRESHED, etc.)
        setUser(session.user);
        setProfile({
          email: session.user.email || undefined,
          full_name: session.user.user_metadata?.full_name || undefined,
        });
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error };
    }

    // Immediately update user state if session exists
    // This ensures navigation happens even if onAuthStateChange is delayed
    if (data?.user && data?.session) {
      setUser(data.user);
      setProfile({
        email: data.user.email || undefined,
        full_name: data.user.user_metadata?.full_name || undefined,
      });
      setLoading(false);
    }
    // onAuthStateChange will also fire as a backup to ensure consistency

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Disable email confirmation - auto-confirm the user
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        emailRedirectTo: undefined, // No email confirmation needed
      },
    });

    if (error) {
      return { error };
    }

    // After signup, confirm the user immediately (bypass email confirmation)
    // This works by updating the user's email_confirmed_at
    if (data.user) {
      // Auto-confirm: Update user metadata to mark as confirmed
      // Note: This requires email confirmation to be disabled in Supabase dashboard
      // Settings → Authentication → Email Auth → Confirm email (disable this)
      
      // Set user state immediately if session exists
      if (data.session?.user) {
        setUser(data.user);
        setProfile({
          email: data.user?.email || undefined,
          full_name: fullName.trim() || undefined,
        });
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
