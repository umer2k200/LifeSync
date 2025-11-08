import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, type LogEntry } from './logger';

const TELEMETRY_KEY = '@lifesync_telemetry_queue';
const MAX_ENTRIES = 200;

let initialized = false;
let queue: LogEntry[] = [];

const persistQueue = async () => {
  try {
    await AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error persisting telemetry queue', error);
  }
};

const loadQueue = async () => {
  try {
    const stored = await AsyncStorage.getItem(TELEMETRY_KEY);
    if (!stored) {
      queue = [];
      return;
    }
    const parsed = JSON.parse(stored) as LogEntry[];
    if (Array.isArray(parsed)) {
      queue = parsed.slice(-MAX_ENTRIES);
    }
  } catch (error) {
    console.error('Error loading telemetry queue', error);
  }
};

export const TelemetryService = {
  async initialize() {
    if (initialized) {
      return;
    }

    await loadQueue();

    Logger.subscribe((entry) => {
      queue.push(entry);
      if (queue.length > MAX_ENTRIES) {
        queue.shift();
      }
      void persistQueue();
    });

    initialized = true;
  },
  getEntries(): LogEntry[] {
    return [...queue];
  },
  clear() {
    queue = [];
    void AsyncStorage.removeItem(TELEMETRY_KEY);
  },
};

