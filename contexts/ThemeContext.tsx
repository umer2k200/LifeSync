import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { supabase } from '@/lib/supabase';

export type Theme = 'light' | 'dark';

export const lightColors = {
  primary: '#6A5ACD',
  secondary: '#14B8A6',
  accent: '#F59E0B',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#FFFFFF',
  surface: '#F3F4F6',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  gradient1: '#6A5ACD',
  gradient2: '#4B3EAE',
};

export const darkColors = {
  primary: '#A78BFA',
  secondary: '#2DD4BF',
  accent: '#FBBF24',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  background: '#111827',
  surface: '#1F2937',
  card: '#374151',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  border: '#4B5563',
  gradient1: '#A78BFA',
  gradient2: '#8B5CF6',
};

interface ThemeContextType {
  theme: Theme;
  colors: typeof lightColors;
  toggleTheme: () => void;
  isDark: boolean;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

let persistedThemeCache: Theme | null = null;

const getInitialTheme = (): Theme => {
  if (persistedThemeCache) {
    return persistedThemeCache;
  }

  const systemTheme = Appearance.getColorScheme();
  return systemTheme === 'light' ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const isStillMounted = () => isMounted;

    loadTheme(isStillMounted);
    
    // Listen for auth changes to load theme from database
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Load theme from database when user logs in
        await loadThemeFromDatabase(session.user.id, isStillMounted);
      } else if (event === 'SIGNED_OUT') {
        // Reset to dark theme when logged out (default)
        setTheme('dark');
        await AsyncStorage.setItem('@lifesync_theme', 'dark');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheme = async (isMounted?: () => boolean) => {
    try {
      // Fallback to AsyncStorage first for immediate theme application
      const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
      if (!isMounted || isMounted()) {
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
          persistedThemeCache = savedTheme;
        } else {
          // First time app load - default to dark mode
          setTheme('dark');
          await AsyncStorage.setItem('@lifesync_theme', 'dark');
          persistedThemeCache = 'dark';
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      // Fallback to AsyncStorage on error
      try {
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if ((!isMounted || isMounted()) && (savedTheme === 'dark' || savedTheme === 'light')) {
          setTheme(savedTheme);
          persistedThemeCache = savedTheme;
        }
      } catch (storageError) {
        console.error('Error loading theme from storage:', storageError);
      }
    } finally {
      if (!isMounted || isMounted()) {
        setLoading(false);
      }
    }

    // Load theme from database in the background if user is logged in
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadThemeFromDatabase(session.user.id, isMounted);
      }
    } catch (error) {
      console.error('Error loading theme session info:', error);
    }
  };

  const loadThemeFromDatabase = async (userId: string, isMounted?: () => boolean) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading theme from database:', error);
        // Fallback to AsyncStorage
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if ((!isMounted || isMounted()) && (savedTheme === 'dark' || savedTheme === 'light')) {
          setTheme(savedTheme);
        }
        return;
      }

      // Type assertion for Supabase query result
      const themeData = data as { theme?: string } | null;
      
      if ((!isMounted || isMounted()) && (themeData?.theme === 'dark' || themeData?.theme === 'light')) {
        setTheme(themeData.theme);
        persistedThemeCache = themeData.theme;
        // Also save to AsyncStorage for offline access
        await AsyncStorage.setItem('@lifesync_theme', themeData.theme);
      } else if (!isMounted || isMounted()) {
        // No theme in database - default to dark for new users
        setTheme('dark');
        await AsyncStorage.setItem('@lifesync_theme', 'dark');
        persistedThemeCache = 'dark';
        // Save to database
        await supabase
          .from('profiles')
          // @ts-ignore - Supabase type inference issue
          .update({ theme: 'dark' })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('Error loading theme from database:', error);
      // Fallback to AsyncStorage
      try {
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if ((!isMounted || isMounted()) && (savedTheme === 'dark' || savedTheme === 'light')) {
          setTheme(savedTheme);
          persistedThemeCache = savedTheme;
        }
      } catch (storageError) {
        console.error('Error loading theme from storage:', storageError);
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    persistedThemeCache = newTheme;
    
    try {
      // Save to AsyncStorage for immediate access
      await AsyncStorage.setItem('@lifesync_theme', newTheme);
      
      // Also save to database if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('profiles')
          // @ts-ignore - Supabase type inference issue
          .update({ theme: newTheme })
          .eq('id', session.user.id);

        if (error) {
          console.error('Error saving theme to database:', error);
        }
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  useEffect(() => {
    const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Honor system preference only if the user hasn't chosen explicitly yet
      if (!persistedThemeCache) {
        const systemTheme = colorScheme === 'light' ? 'light' : 'dark';
        setTheme(systemTheme);
      }
    });

    return () => {
      appearanceSubscription.remove();
    };
  }, []);

  if (loading) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        toggleTheme,
        isDark: theme === 'dark',
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
