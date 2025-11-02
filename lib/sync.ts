import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { OfflineStorage } from './storage';

export interface SyncableItem {
  id: string;
  synced?: boolean;
  user_id?: string;
}

export class SyncService {
  private static isOnline = true;
  private static syncInProgress = false;

  static async initialize(): Promise<void> {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        this.syncAllData();
      }
    });

    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
  }

  static getConnectionStatus(): boolean {
    return this.isOnline;
  }

  static async syncTable<T extends SyncableItem>(
    tableName: string,
    userId: string
  ): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    try {
      const offlineData = await OfflineStorage.load<T>(tableName, userId);
      const unsyncedItems = offlineData.filter((item) => !item.synced);

      if (unsyncedItems.length === 0) return;

      for (const item of unsyncedItems) {
        const { synced, ...dataToSync } = item;

        const { error } = await (supabase
          .from(tableName) as any)
          .upsert({ ...dataToSync, synced: true } as any);

        if (!error) {
          await OfflineStorage.append(tableName, userId, { ...item, synced: true } as T);
        }
      }

      const { data: remoteData, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId);

      if (!error && remoteData) {
        await OfflineStorage.save(tableName, userId, remoteData);
      }
    } catch (error) {
      console.error(`Error syncing ${tableName}:`, error);
    }
  }

  static async syncAllData(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tables = [
        'goals',
        'goal_milestones',
        'habits',
        'habit_logs',
        'workouts',
        'exercises',
        'workout_logs',
        'exercise_logs',
        'meals',
        'water_logs',
        'tasks',
        'task_categories',
        'expenses',
        'expense_categories',
        'incomes',
        'loans',
        'quran_progress',
        'tasbeeh_logs',
        'charity_reminders',
        'push_tokens',
      ];

      for (const table of tables) {
        await this.syncTable(table, user.id);
      }
    } catch (error) {
      console.error('Error during full sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  static async fetchWithFallback<T>(
    tableName: string,
    userId: string,
    query?: any
  ): Promise<T[]> {
    if (this.isOnline) {
      try {
        let queryBuilder = supabase.from(tableName).select('*').eq('user_id', userId);

        if (query) {
          queryBuilder = query(queryBuilder);
        }

        const { data, error } = await queryBuilder;

        if (!error && data) {
          await OfflineStorage.save(tableName, userId, data);
          return data;
        }
      } catch (error) {
        console.error(`Error fetching ${tableName} from server:`, error);
      }
    }

    return await OfflineStorage.load<T>(tableName, userId);
  }

  static async insertWithFallback<T extends SyncableItem>(
    tableName: string,
    userId: string,
    item: any
  ): Promise<T | null> {
    const id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem = { ...item, id, user_id: userId, synced: false } as T;

    await OfflineStorage.append(tableName, userId, newItem);

    if (this.isOnline) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .insert({ ...item, user_id: userId })
          .select()
          .single();

        if (!error && data) {
          await OfflineStorage.remove(tableName, userId, id);
          await OfflineStorage.append(tableName, userId, { ...(data as any), synced: true } as T);
          return data as T;
        }
      } catch (error) {
        console.error(`Error inserting to ${tableName}:`, error);
      }
    }

    return newItem;
  }

  static async updateWithFallback<T extends SyncableItem>(
    tableName: string,
    userId: string,
    id: string,
    updates: any
  ): Promise<void> {
    const offlineData = await OfflineStorage.load<T>(tableName, userId);
    const itemIndex = offlineData.findIndex((item) => item.id === id);

    if (itemIndex >= 0) {
      offlineData[itemIndex] = { ...offlineData[itemIndex], ...updates, synced: false };
      await OfflineStorage.save(tableName, userId, offlineData);
    }

    if (this.isOnline) {
      try {
        await (supabase.from(tableName) as any).update(updates).eq('id', id);
      } catch (error) {
        console.error(`Error updating ${tableName}:`, error);
      }
    }
  }

  static async deleteWithFallback(
    tableName: string,
    userId: string,
    id: string
  ): Promise<void> {
    await OfflineStorage.remove(tableName, userId, id);

    if (this.isOnline) {
      try {
        await (supabase.from(tableName) as any).delete().eq('id', id);
      } catch (error) {
        console.error(`Error deleting from ${tableName}:`, error);
      }
    }
  }
}
