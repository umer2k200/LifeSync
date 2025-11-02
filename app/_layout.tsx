import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { User } from '@supabase/supabase-js';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncService } from '@/lib/sync';
import { GlobalAlert } from '@/components/StyledAlert';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const lastUserRef = useRef<User | null>(user);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentScreen = segments[segments.length - 1] || '';
    const isLoginOrSignup = currentScreen === 'login' || currentScreen === 'signup';
    
    // Track if user state actually changed (not just navigation)
    const userChanged = lastUserRef.current !== user;
    const wasNull = lastUserRef.current === null;
    lastUserRef.current = user;

    // If user is not authenticated and not in auth group, go to login
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    } 
    // If user is authenticated and on auth screens
    if (user && inAuthGroup) {
      // Redirect if user just signed in (was null, now has user)
      // OR if user exists and we're on login/signup screens
      if ((userChanged && wasNull && user) || isLoginOrSignup) {
        // User just signed in - redirect after short delay to ensure state is settled
        const timer = setTimeout(() => {
          // Double-check user still exists before navigating (prevent race condition)
          if (user) {
          router.replace('/(tabs)');
          }
        }, 100);
        return () => clearTimeout(timer);
      } else if (!isLoginOrSignup) {
        // Not on login/signup but in auth group - redirect immediately
        if (user) {
        router.replace('/(tabs)');
        }
      }
    }
  }, [user, loading, segments, router]);

  useEffect(() => {
    SyncService.initialize();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="settings" />
      </Stack>
      <GlobalAlert />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
