import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import type { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncService } from '@/lib/sync';
import { NotificationService } from '@/lib/notifications';
import { NotificationScheduler } from '@/lib/notificationScheduler';
import { GlobalAlert } from '@/components/StyledAlert';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = '@lifesync_onboarding_completed';

function RootLayoutNav() {
  const { user, loading: authLoading } = useAuth();
  const { loading: themeLoading } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const lastUserRef = useRef<User | null>(user);
  const [hasOnboardingBeenShown, setHasOnboardingBeenShown] = useState<boolean | null>(null);

  // Check if onboarding has been shown
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const onboardingValue = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasOnboardingBeenShown(onboardingValue === 'true');
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setHasOnboardingBeenShown(false);
      }
    };
    checkOnboarding();
    
    // Periodically check for completion (catches async saves)
    const interval = setInterval(async () => {
      try {
        const onboardingValue = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (onboardingValue === 'true' && hasOnboardingBeenShown === false) {
          setHasOnboardingBeenShown(true);
        }
      } catch {
        // Ignore errors
      }
    }, 300);
    
    return () => clearInterval(interval);
  }, [hasOnboardingBeenShown]);

  // Hide splash screen when both auth and theme are loaded
  useEffect(() => {
    if (!authLoading && !themeLoading && hasOnboardingBeenShown !== null) {
      SplashScreen.hideAsync();
    }
  }, [authLoading, themeLoading, hasOnboardingBeenShown]);

  useEffect(() => {
    if (authLoading || themeLoading || hasOnboardingBeenShown === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = segments[segments.length - 1] === 'onboarding';
    const currentScreen = segments[segments.length - 1] || '';
    const isLoginOrSignup = currentScreen === 'login' || currentScreen === 'signup';
    
    // Track if user state actually changed (not just navigation)
    const userChanged = lastUserRef.current !== user;
    const wasNull = lastUserRef.current === null;
    lastUserRef.current = user;

    // Show onboarding if it hasn't been shown yet (only if not already navigating to/from it)
    if (!hasOnboardingBeenShown && !isOnboarding && !user && !inAuthGroup && !isLoginOrSignup) {
      router.replace('/onboarding');
      return;
    }

    // If user is not authenticated and onboarding is done, go to login (but not if already on login/signup)
    if (!user && !inAuthGroup && !isOnboarding && hasOnboardingBeenShown && !isLoginOrSignup) {
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
  }, [user, authLoading, themeLoading, hasOnboardingBeenShown, segments, router]);

  useEffect(() => {
    SyncService.initialize();
  }, []);

  // Initialize push notifications when user is logged in
  const notificationsInitializedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!user) {
      // Reset when user logs out
      notificationsInitializedRef.current = null;
      return;
    }

    // Prevent duplicate initialization for the same user
    if (notificationsInitializedRef.current === user.id) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let isCancelled = false;

    const initializeNotifications = async () => {
      try {
        // Check if notifications are enabled first
        const hasPermission = await NotificationService.areNotificationsEnabled();
        
        // Check if cancelled before proceeding
        if (isCancelled) return;
        
        if (hasPermission) {
          // Register for push notifications
          await NotificationService.registerForPushNotifications(user.id);
          
          // Check again if cancelled
          if (isCancelled) return;
          
          // Schedule all app notifications (only once per user)
          await NotificationScheduler.scheduleAllNotifications(user.id);
          
          // Mark as initialized for this user
          notificationsInitializedRef.current = user.id;
        }

        // Set up notification listeners (always set up, even if permissions not granted yet)
        if (!isCancelled) {
          cleanup = NotificationService.initializeNotificationListeners(
            // Notification received (foreground)
            (notification) => {
              console.log('Notification received:', notification);
              // You can show a custom in-app notification here
            },
            // Notification tapped (opened from notification)
            (response) => {
              console.log('Notification tapped:', response);
              const data = response.notification.request.content.data;
              
              // Navigate based on notification data
              if (data?.screen) {
                router.push(data.screen as any);
              }
            }
          );
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();

    // Cleanup on unmount or user change
    return () => {
      isCancelled = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [user, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
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
        <CurrencyProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
