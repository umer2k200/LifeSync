import AsyncStorage from '@react-native-async-storage/async-storage';

export class OfflineStorage {
  private static async getKey(table: string, userId: string): Promise<string> {
    return `@lifesync_${table}_${userId}`;
  }

  static async save<T>(table: string, userId: string, data: T[]): Promise<void> {
    try {
      const key = await this.getKey(table, userId);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${table} to offline storage:`, error);
    }
  }

  static async load<T>(table: string, userId: string): Promise<T[]> {
    try {
      const key = await this.getKey(table, userId);
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error loading ${table} from offline storage:`, error);
      return [];
    }
  }

  static async append<T extends { id: string }>(
    table: string,
    userId: string,
    item: T
  ): Promise<void> {
    try {
      const data = await this.load<T>(table, userId);
      const existingIndex = data.findIndex((d) => d.id === item.id);

      if (existingIndex >= 0) {
        data[existingIndex] = item;
      } else {
        data.push(item);
      }

      await this.save(table, userId, data);
    } catch (error) {
      console.error(`Error appending to ${table}:`, error);
    }
  }

  static async remove(table: string, userId: string, id: string): Promise<void> {
    try {
      const data = await this.load<{ id: string }>(table, userId);
      const filtered = data.filter((item) => item.id !== id);
      await this.save(table, userId, filtered);
    } catch (error) {
      console.error(`Error removing from ${table}:`, error);
    }
  }

  static async clear(table: string, userId: string): Promise<void> {
    try {
      const key = await this.getKey(table, userId);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing ${table}:`, error);
    }
  }

  static async clearAll(userId: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter((key) => key.includes(`@lifesync_`) && key.includes(userId));
      await AsyncStorage.multiRemove(userKeys);
    } catch (error) {
      console.error('Error clearing all offline data:', error);
    }
  }
}
