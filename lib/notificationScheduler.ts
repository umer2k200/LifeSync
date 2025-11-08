/**
 * Notification Scheduler Service
 * Manages all scheduled notifications for the app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from './notifications';
import { SyncService } from './sync';
import * as Notifications from 'expo-notifications';
import { parseISO, addDays, isPast } from 'date-fns';
import { Logger } from './logger';

interface Habit {
  id: string;
  name: string;
  reminder_time?: string; // Format: "HH:mm"
  reminder_enabled?: boolean;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  is_completed: boolean;
  priority: string;
}

export class NotificationScheduler {
  // Track ongoing scheduling operations to prevent duplicates
  private static schedulingInProgress = new Set<string>();
  private static readonly SCHEDULE_VERSION = 1;
  private static readonly SCHEDULE_TTL_MS = 1000 * 60 * 60; // 1 hour
  private static readonly SCHEDULE_KEY_PREFIX = '@lifesync_notifications_schedule_';

  private static getScheduleKey(userId: string): string {
    return `${this.SCHEDULE_KEY_PREFIX}${userId}`;
  }

  private static async getScheduleRecord(userId: string): Promise<{ version: number; scheduledAt: number } | null> {
    try {
      const raw = await AsyncStorage.getItem(this.getScheduleKey(userId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as { version: number; scheduledAt: number };
      if (typeof parsed.version !== 'number' || typeof parsed.scheduledAt !== 'number') {
        return null;
      }
      return parsed;
    } catch (error) {
      console.error('Error reading notification schedule record:', error);
      return null;
    }
  }

  private static async setScheduleRecord(userId: string, record: { version: number; scheduledAt: number }): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getScheduleKey(userId), JSON.stringify(record));
    } catch (error) {
      console.error('Error persisting notification schedule record:', error);
    }
  }

  private static async clearScheduleRecord(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getScheduleKey(userId));
    } catch (error) {
      console.error('Error clearing notification schedule record:', error);
    }
  }

  private static async shouldReschedule(userId: string): Promise<boolean> {
    const record = await this.getScheduleRecord(userId);
    if (!record) {
      return true;
    }

    if (record.version !== this.SCHEDULE_VERSION) {
      return true;
    }

    const scheduleAge = Date.now() - record.scheduledAt;
    if (scheduleAge > this.SCHEDULE_TTL_MS) {
      return true;
    }

    return false;
  }

  static async getLastScheduleTimestamp(userId: string): Promise<number | null> {
    const record = await this.getScheduleRecord(userId);
    return record ? record.scheduledAt : null;
  }

  static async getScheduleMetadata(userId: string): Promise<{ version: number; scheduledAt: number } | null> {
    return this.getScheduleRecord(userId);
  }

  /**
   * Schedule all notifications for a user
   * This should be called when the app starts or user logs in
   */
  static async scheduleAllNotifications(userId: string): Promise<void> {
    // Prevent duplicate scheduling for the same user
    if (this.schedulingInProgress.has(userId)) {
      Logger.debug('Notification scheduling already in progress, skipping', { userId });
      return;
    }

    this.schedulingInProgress.add(userId);

    try {
      const needsReschedule = await this.shouldReschedule(userId);
      if (!needsReschedule) {
        Logger.debug('Notification schedule is still fresh, skipping reschedule', { userId });
        return;
      }

      // First, cancel all existing notifications to avoid duplicates
      await NotificationService.cancelAllNotifications();
      
      // Check if notifications are enabled
      const hasPermission = await NotificationService.areNotificationsEnabled();
      if (!hasPermission) {
        Logger.info('Notifications not enabled, skipping scheduling', { userId });
        return;
      }

      // Schedule different types of notifications
      await Promise.all([
        this.scheduleHabitReminders(userId),
        this.scheduleTaskReminders(userId),
        this.scheduleWaterReminders(userId),
        this.scheduleCharityReminders(userId),
      ]);

      Logger.info('Notifications scheduled successfully', { userId });
      await this.setScheduleRecord(userId, {
        version: this.SCHEDULE_VERSION,
        scheduledAt: Date.now(),
      });
    } catch (error) {
      Logger.error('Error scheduling notifications', { userId }, error);
      await this.clearScheduleRecord(userId);
    } finally {
      // Remove from in-progress set after a short delay to allow async operations to complete
      setTimeout(() => {
        this.schedulingInProgress.delete(userId);
      }, 1000);
    }
  }

  /**
   * Schedule daily habit reminders
   */
  static async scheduleHabitReminders(userId: string): Promise<void> {
    try {
      const habits = await SyncService.fetchWithFallback<Habit>('habits', userId);
      
      // Filter habits with reminders enabled and a reminder time
      const habitsWithReminders = habits.filter(
        (habit) => habit.reminder_enabled && habit.reminder_time
      );

      for (const habit of habitsWithReminders) {
        const [hour, minute] = habit.reminder_time!.split(':').map(Number);
        
        // Schedule daily notification
        await NotificationService.scheduleNotificationWithData(
          `Time for ${habit.name}!`,
          `Don't forget to complete your ${habit.name} habit today`,
          {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
          {
            type: 'habit_reminder',
            habit_id: habit.id,
            screen: '/(tabs)/habits',
          }
        );
      }

      Logger.debug('Habit reminders scheduled', {
        userId,
        count: habitsWithReminders.length,
      });
    } catch (error) {
      Logger.error('Error scheduling habit reminders', { userId }, error);
    }
  }

  /**
   * Schedule task due date reminders
   */
  static async scheduleTaskReminders(userId: string): Promise<void> {
    try {
      const tasks = await SyncService.fetchWithFallback<Task>('tasks', userId);
      
      // Filter tasks that have due dates and are not completed
      const tasksWithDueDates = tasks.filter(
        (task) => task.due_date && !task.is_completed && !isPast(parseISO(task.due_date))
      );

      for (const task of tasksWithDueDates) {
        const dueDate = parseISO(task.due_date!);
        
        // Schedule reminder for the day before (at 18:00)
        const reminderDate = addDays(dueDate, -1);
        const reminderDateTime = new Date(reminderDate);
        reminderDateTime.setHours(18, 0, 0, 0);
        
        if (!isPast(reminderDateTime)) {
          await NotificationService.scheduleNotificationWithData(
            'Task Due Tomorrow',
            `${task.title} is due tomorrow`,
            {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminderDateTime,
            },
            {
              type: 'task_reminder',
              task_id: task.id,
              screen: '/(tabs)/tasks',
            }
          );
        }

        // Schedule reminder for due date (at 9:00 AM)
        const dueDateTime = new Date(dueDate);
        dueDateTime.setHours(9, 0, 0, 0);
        
        if (!isPast(dueDateTime)) {
          await NotificationService.scheduleNotificationWithData(
            `Task Due: ${task.title}`,
            `Don't forget about this ${task.priority} priority task`,
            {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: dueDateTime,
            },
            {
              type: 'task_reminder',
              task_id: task.id,
              screen: '/(tabs)/tasks',
            }
          );
        }
      }

      Logger.debug('Task reminders scheduled', {
        userId,
        count: tasksWithDueDates.length,
      });
    } catch (error) {
      Logger.error('Error scheduling task reminders', { userId }, error);
    }
  }

  /**
   * Schedule water intake reminders based on user settings
   */
  static async scheduleWaterReminders(userId: string): Promise<void> {
    try {
      // Fetch water reminder settings from database
      const settings = await SyncService.fetchWithFallback<{
        enabled: boolean;
        interval_hours: number;
        start_hour: number;
        start_minute: number;
        end_hour: number;
        end_minute: number;
      }>('water_reminder_settings', userId);

      // If no settings found or reminders disabled, skip scheduling
      if (!settings || settings.length === 0 || !settings[0].enabled) {
        Logger.debug('Water reminders disabled or no settings found', { userId });
        return;
      }

      const { interval_hours, start_hour, start_minute, end_hour, end_minute } = settings[0];

      // Calculate reminder times based on interval
      const reminderTimes: { hour: number; minute: number }[] = [];
      const startTimeMinutes = start_hour * 60 + start_minute;
      const endTimeMinutes = end_hour * 60 + end_minute;

      let currentTimeMinutes = startTimeMinutes;
      while (currentTimeMinutes <= endTimeMinutes) {
        const hour = Math.floor(currentTimeMinutes / 60);
        const minute = currentTimeMinutes % 60;
        reminderTimes.push({ hour, minute });
        currentTimeMinutes += interval_hours * 60;
      }

      // Schedule notifications for each time
      for (const { hour, minute } of reminderTimes) {
        await NotificationService.scheduleNotificationWithData(
          'Stay Hydrated! 💧',
          'Don\'t forget to drink water. Your body needs it!',
          {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
          {
            type: 'water_reminder',
            screen: '/(tabs)/habits',
          }
        );
      }

      Logger.debug('Water reminders scheduled', {
        userId,
        count: reminderTimes.length,
      });
    } catch (error) {
      Logger.error('Error scheduling water reminders', { userId }, error);
    }
  }

  /**
   * Schedule charity reminders (already handled in Islamic section)
   * This is a placeholder - actual scheduling is done when user enables charity reminders
   */
  static async scheduleCharityReminders(userId: string): Promise<void> {
    try {
      const charityReminders = await SyncService.fetchWithFallback<any>('charity_reminders', userId);
      
      // Charity reminders are already scheduled via the Islamic screen
      // This function is here for consistency
      Logger.debug('Charity reminders already handled elsewhere', {
        userId,
        count: charityReminders.length,
      });
    } catch (error) {
      Logger.error('Error checking charity reminders', { userId }, error);
    }
  }

  /**
   * Reschedule notifications (useful when data changes)
   */
  static async rescheduleNotifications(userId: string): Promise<void> {
    await this.clearScheduleRecord(userId);
    await this.scheduleAllNotifications(userId);
  }
}

