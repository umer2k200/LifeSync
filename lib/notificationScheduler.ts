/**
 * Notification Scheduler Service
 * Manages all scheduled notifications for the app
 */

import { NotificationService } from './notifications';
import { SyncService } from './sync';
import * as Notifications from 'expo-notifications';
import { parseISO, addDays, isPast } from 'date-fns';

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
  /**
   * Schedule all notifications for a user
   * This should be called when the app starts or user logs in
   */
  static async scheduleAllNotifications(userId: string): Promise<void> {
    try {
      // First, cancel all existing notifications to avoid duplicates
      await NotificationService.cancelAllNotifications();
      
      // Check if notifications are enabled
      const hasPermission = await NotificationService.areNotificationsEnabled();
      if (!hasPermission) {
        console.log('Notifications not enabled, skipping scheduling');
        return;
      }

      // Schedule different types of notifications
      await Promise.all([
        this.scheduleHabitReminders(userId),
        this.scheduleTaskReminders(userId),
        this.scheduleWaterReminders(userId),
        this.scheduleCharityReminders(userId),
      ]);

      console.log('All notifications scheduled successfully');
    } catch (error) {
      console.error('Error scheduling notifications:', error);
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

      console.log(`Scheduled ${habitsWithReminders.length} habit reminders`);
    } catch (error) {
      console.error('Error scheduling habit reminders:', error);
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

      console.log(`Scheduled reminders for ${tasksWithDueDates.length} tasks`);
    } catch (error) {
      console.error('Error scheduling task reminders:', error);
    }
  }

  /**
   * Schedule water intake reminders (every 2 hours from 8 AM to 10 PM)
   */
  static async scheduleWaterReminders(userId: string): Promise<void> {
    try {
      const hours = [8, 10, 12, 14, 16, 18, 20, 22]; // Every 2 hours

      for (const hour of hours) {
        await NotificationService.scheduleNotificationWithData(
          'Stay Hydrated! 💧',
          'Don\'t forget to drink water. Your body needs it!',
          {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute: 0,
          },
          {
            type: 'water_reminder',
            screen: '/(tabs)/habits',
          }
        );
      }

      console.log('Scheduled water intake reminders');
    } catch (error) {
      console.error('Error scheduling water reminders:', error);
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
      console.log(`Found ${charityReminders.length} charity reminders (already scheduled)`);
    } catch (error) {
      console.error('Error checking charity reminders:', error);
    }
  }

  /**
   * Reschedule notifications (useful when data changes)
   */
  static async rescheduleNotifications(userId: string): Promise<void> {
    await this.scheduleAllNotifications(userId);
  }
}

