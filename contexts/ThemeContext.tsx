import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    loadTheme();
    
    // Listen for auth changes to load theme from database
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Load theme from database when user logs in
        await loadThemeFromDatabase(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Reset to light theme when logged out
        setTheme('light');
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTheme = async () => {
    try {
      // First try to load from database if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadThemeFromDatabase(session.user.id);
      } else {
        // Fallback to AsyncStorage if not logged in
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      // Fallback to AsyncStorage on error
      try {
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
      } catch (storageError) {
        console.error('Error loading theme from storage:', storageError);
      }
    }
  };

  const loadThemeFromDatabase = async (userId: string) => {
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
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
        return;
      }

      // Type assertion for Supabase query result
      const themeData = data as { theme?: string } | null;
      
      if (themeData?.theme === 'dark' || themeData?.theme === 'light') {
        setTheme(themeData.theme);
        // Also save to AsyncStorage for offline access
        await AsyncStorage.setItem('@lifesync_theme', themeData.theme);
      } else {
        // No theme in database, use AsyncStorage
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
      }
    } catch (error) {
      console.error('Error loading theme from database:', error);
      // Fallback to AsyncStorage
      try {
        const savedTheme = await AsyncStorage.getItem('@lifesync_theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
      } catch (storageError) {
        console.error('Error loading theme from storage:', storageError);
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        toggleTheme,
        isDark: theme === 'dark',
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
