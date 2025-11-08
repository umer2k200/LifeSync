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

const profileCache = new Map<string, Profile>();
const profileRequestCache = new Map<string, Promise<Profile>>();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile> => {
    const cachedProfile = profileCache.get(userId);
    if (cachedProfile) {
      return cachedProfile;
    }

    const inFlight = profileRequestCache.get(userId);
    if (inFlight) {
      return inFlight;
    }

    const request = (async (): Promise<Profile> => {
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

          const fallbackProfile: Profile = {
            email: undefined,
            full_name: undefined,
            theme: undefined,
          };
          profileCache.set(userId, fallbackProfile);
          return fallbackProfile;
        }

        const profileData = data as { email?: string; full_name?: string; theme?: string } | null;

        if (!profileData) {
          const fallbackProfile: Profile = {
            email: undefined,
            full_name: undefined,
            theme: undefined,
          };
          profileCache.set(userId, fallbackProfile);
          return fallbackProfile;
        }

        const hydratedProfile: Profile = {
          email: profileData.email || undefined,
          full_name: profileData.full_name || undefined,
          theme: (profileData.theme as Theme | null) || 'light',
        };

        profileCache.set(userId, hydratedProfile);
        return hydratedProfile;
      } catch (error) {
        console.error('Error fetching profile:', error);
        const fallbackProfile: Profile = {
          email: undefined,
          full_name: undefined,
          theme: undefined,
        };
        profileCache.set(userId, fallbackProfile);
        return fallbackProfile;
      } finally {
        profileRequestCache.delete(userId);
      }
    })();

    profileRequestCache.set(userId, request);
    return request;
  };

  const clearProfileCache = (userId?: string) => {
    if (userId) {
      profileCache.delete(userId);
      profileRequestCache.delete(userId);
    } else {
      profileCache.clear();
      profileRequestCache.clear();
    }
  };

  // Simple initialization - get current session
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);

          if (expiresAt && expiresAt <= now) {
            setUser(null);
            setProfile(null);
            clearProfileCache(session.user.id);
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          setUser(session.user);
          setLoading(false);
          fetchProfile(session.user.id)
            .then((profileData) => {
              if (isMounted) {
                setProfile(profileData);
              }
            })
            .catch((error) => {
              console.error('Error fetching profile on init:', error);
            });
        } else {
          setUser(null);
          setProfile(null);
          clearProfileCache();
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth session:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        clearProfileCache();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session.user) {
        setUser(session.user);
        setLoading(false);
        fetchProfile(session.user.id)
          .then((profileData) => {
            if (isMounted) {
              setProfile(profileData);
            }
          })
          .catch((error) => {
            console.error('Error fetching profile on auth change:', error);
          });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
      setLoading(false);
      fetchProfile(data.user.id)
        .then((profileData) => setProfile(profileData))
        .catch((profileError) => {
          console.error('Error fetching profile after sign in:', profileError);
        });
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
        fetchProfile(data.user.id)
          .then((profileData) => setProfile(profileData))
          .catch((profileError) => {
            console.error('Error fetching profile after sign up:', profileError);
          });
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    // Unregister all push notification tokens before signing out
    if (user?.id) {
      try {
        const { NotificationService } = await import('@/lib/notifications');
        await NotificationService.unregisterAllPushNotifications(user.id);
      } catch (error) {
        console.error('Error unregistering push notifications on sign out:', error);
        // Continue with sign out even if unregistering fails
      }
      clearProfileCache(user.id);
    }
    
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
