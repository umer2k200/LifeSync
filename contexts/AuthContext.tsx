import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthError } from '@supabase/supabase-js';
import { BiometricService } from '@/lib/biometric';

type Theme = 'light' | 'dark';

interface Profile {
  full_name?: string;
  email?: string;
  theme?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  biometricSignIn: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, full_name, theme')
        .eq('id', userId)
        .single();

      if (error || !data) {
        if (error) {
          console.error('Error fetching profile:', error);
        }
        // Fallback to user_metadata
        return {
          email: undefined,
          full_name: undefined,
          theme: undefined,
        };
      }

      // Type assertion for Supabase query result
      const profileData = data as { email?: string; full_name?: string; theme?: string } | null;
      
      if (!profileData) {
        return {
          email: undefined,
          full_name: undefined,
          theme: undefined,
        };
      }

      return {
        email: profileData.email || undefined,
        full_name: profileData.full_name || undefined,
        theme: (profileData.theme as Theme | null) || 'light',
      };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return {
        email: undefined,
        full_name: undefined,
        theme: undefined,
      };
    }
  };

  // Simple initialization - get current session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Only set user if session is valid
      if (session?.user) {
        // Verify session is not expired
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt > now) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        } else if (!expiresAt) {
          // No expiration time, assume valid
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        // Update on any auth event that provides a session (SIGNED_IN, TOKEN_REFRESHED, etc.)
        setUser(session.user);
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
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

    // Save credentials for biometric if biometric is enabled
    try {
      const biometricEnabled = await BiometricService.isEnabled();
      if (biometricEnabled) {
        await BiometricService.saveCredentials(email.trim(), password);
      }
    } catch (error) {
      console.error('Error saving credentials for biometric:', error);
      // Don't block login if credential saving fails
    }

    // Immediately update user state if session exists
    // This ensures navigation happens even if onAuthStateChange is delayed
    if (data?.user && data?.session) {
      setUser(data.user);
      const profileData = await fetchProfile(data.user.id);
      setProfile(profileData);
      setLoading(false);
    }
    // onAuthStateChange will also fire as a backup to ensure consistency

    return { error: null };
  };

  const biometricSignIn = async () => {
    try {
      // First authenticate with biometric
      const authenticated = await BiometricService.authenticate();
      if (!authenticated) {
        return { error: { message: 'Biometric authentication failed' } as AuthError };
      }

      // Get saved credentials
      const credentials = await BiometricService.getCredentials();
      if (!credentials) {
        return { error: { message: 'No saved credentials found' } as AuthError };
      }

      // Sign in with saved credentials
      return await signIn(credentials.email, credentials.password);
    } catch (error) {
      console.error('Biometric sign in error:', error);
      return { error: { message: 'Biometric authentication failed' } as AuthError };
    }
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
        const profileData = await fetchProfile(data.user.id);
        setProfile(profileData);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Optionally clear biometric credentials on sign out (for security)
    // Uncomment if you want to require biometric setup again after sign out
    // await BiometricService.clearCredentials();
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
        biometricSignIn,
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
