import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { SyncService } from './sync';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface CharityReminder {
  id: string;
  title: string;
  description?: string;
  frequency: string;
  next_reminder_date: string;
  is_active: boolean;
  notification_id?: string;
}

export class NotificationService {
  /**
   * Request notification permissions from the user
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6A5ACD',
        });

        await Notifications.setNotificationChannelAsync('charity', {
          name: 'Charity Reminders',
          description: 'Notifications for charity and giving reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6A5ACD',
          sound: 'default',
        });
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Schedule a notification for a specific date/time
   */
  static async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'charity',
        },
        trigger,
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Schedule a notification with custom data
   */
  static async scheduleNotificationWithData(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: any
  ): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return null;
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data,
        },
        trigger,
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Schedule a recurring Thursday charity reminder
   */
  static async scheduleThursdayCharityReminder(
    title: string,
    description: string,
    hour: number = 18,
    minute: number = 0
  ): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return null;
      }

      // Schedule notification for every Thursday at specified time
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: description,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'charity',
          data: {
            type: 'charity_reminder',
            frequency: 'weekly',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 4, // Thursday (1 = Sunday, 4 = Thursday)
          hour,
          minute,
        },
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling Thursday charity reminder:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  static async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Register push notification token with backend
   * Gets Expo Push Token and saves it to database
   */
  static async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      // Only work on physical devices
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return null;
      }

      // Get Expo Push Token (works in production)
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      const token = tokenData.data;
      const platform = Platform.OS;
      const deviceId = Device.modelName || Device.modelId || 'unknown';

      // Save token to database - try direct sync first if online
      if (SyncService.getConnectionStatus()) {
        try {
          const { error } = await (supabase
            .from('push_tokens') as any)
            .upsert({
              user_id: userId,
              token,
              platform,
              device_id: deviceId,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,token',
            });

          if (error) {
            console.error('Error syncing push token to Supabase:', error);
            // Fallback to SyncService if direct sync fails
            await SyncService.insertWithFallback('push_tokens', userId, {
              token,
              platform,
              device_id: deviceId,
            });
          }
        } catch (error) {
          console.error('Error syncing push token to Supabase:', error);
          // Fallback to SyncService if direct sync fails
          await SyncService.insertWithFallback('push_tokens', userId, {
            token,
            platform,
            device_id: deviceId,
          });
        }
      } else {
        // Offline mode - save to local storage
        await SyncService.insertWithFallback('push_tokens', userId, {
          token,
          platform,
          device_id: deviceId,
        });
      }

      console.log('Push notification token registered:', token);
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Unregister push notification token
   */
  static async unregisterPushNotifications(userId: string, token: string): Promise<void> {
    try {
      await SyncService.deleteWithFallback('push_tokens', userId, token);
      
      if (SyncService.getConnectionStatus()) {
        try {
          await supabase
            .from('push_tokens')
            .delete()
            .eq('user_id', userId)
            .eq('token', token);
        } catch (error) {
          console.error('Error deleting push token from Supabase:', error);
        }
      }
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }

  /**
   * Get all registered push tokens for a user
   */
  static async getUserPushTokens(userId: string): Promise<string[]> {
    try {
      const tokens = await SyncService.fetchWithFallback<{ token: string }>('push_tokens', userId);
      return tokens.map(t => t.token);
    } catch (error) {
      console.error('Error getting user push tokens:', error);
      return [];
    }
  }

  /**
   * Initialize notification listeners
   */
  static initializeNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationTapped: (response: Notifications.NotificationResponse) => void
  ): () => void {
    // Listener for notifications received while app is in foreground
    const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);

    // Listener for when user taps on notification
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  /**
   * Send a local notification (for testing)
   */
  static async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permissions not granted');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  static async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }
}

