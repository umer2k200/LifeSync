import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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
import { AppEventBus } from '@/lib/eventBus';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { TelemetryService } from '@/lib/telemetry';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = '@lifesync_onboarding_completed';

function RootLayoutNav() {
  const { user, loading: authLoading } = useAuth();
  const { loading: themeLoading } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [hasOnboardingBeenShown, setHasOnboardingBeenShown] = useState<boolean | null>(null);
  const splashHiddenRef = useRef(false);

  const hideSplash = useCallback(async () => {
    if (splashHiddenRef.current) {
      return;
    }
    splashHiddenRef.current = true;
    try {
      await SplashScreen.hideAsync();
    } catch (error) {
      console.warn('Failed to hide splash screen:', error);
    }
  }, []);

  // Check if onboarding has been shown and subscribe to completion events
  useEffect(() => {
    let isMounted = true;

    const checkOnboarding = async () => {
      try {
        const onboardingValue = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!isMounted) {
          return;
        }
        setHasOnboardingBeenShown(onboardingValue === 'true');
      } catch (error) {
        console.error('Error checking onboarding:', error);
        if (isMounted) {
        setHasOnboardingBeenShown(false);
        }
      }
    };

    checkOnboarding();
    
    const unsubscribe = AppEventBus.on('onboardingCompleted', () => {
      if (!isMounted) {
        return;
      }
          setHasOnboardingBeenShown(true);
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Hide splash screen when both auth and theme are loaded
  useEffect(() => {
    if (!authLoading && !themeLoading && hasOnboardingBeenShown !== null) {
      hideSplash();
    }
  }, [authLoading, themeLoading, hasOnboardingBeenShown, hideSplash]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      hideSplash();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [hideSplash]);

  const navigationTarget = useMemo(() => {
    if (authLoading || themeLoading || hasOnboardingBeenShown === null) {
      return null;
    }

    const rootSegment = segments[0] ?? '';
    const currentScreen = segments[segments.length - 1] ?? '';
    const inAuthGroup = rootSegment === '(auth)';
    const isOnboardingScreen = currentScreen === 'onboarding' || rootSegment === 'onboarding';
    const isLoginOrSignup = currentScreen === 'login' || currentScreen === 'signup';
    
    if (!hasOnboardingBeenShown && !isOnboardingScreen) {
      return '/onboarding';
    }

    if (!user) {
      if (!inAuthGroup || (!isLoginOrSignup && !isOnboardingScreen)) {
        return '/(auth)/login';
      }
      return null;
    }

    if (isOnboardingScreen || inAuthGroup) {
      return '/(tabs)';
    }

    return null;
  }, [authLoading, themeLoading, hasOnboardingBeenShown, segments, user]);

  useEffect(() => {
    if (!navigationTarget) {
      return;
    } 
    router.replace(navigationTarget as any);
  }, [navigationTarget, router]);

  useEffect(() => {
    SyncService.initialize();
  }, []);

  // Initialize push notifications when user is logged in
  const notificationsInitializedRef = useRef<string | null>(null);
  const { status: notificationStatus, refreshPermissions } = useNotifications();
  
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
        // Ensure we have the latest permission state
        let hasPermission = notificationStatus === 'granted';
        if (notificationStatus === 'unknown') {
          hasPermission = await NotificationService.areNotificationsEnabled();
          await refreshPermissions();
        }
        
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
  }, [user, router, notificationStatus, refreshPermissions]);

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
  useEffect(() => {
    TelemetryService.initialize();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
            <NotificationProvider>
            <RootLayoutNav />
            </NotificationProvider>
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
