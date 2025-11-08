type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: unknown;
}

type Subscriber = (entry: LogEntry) => void;

const subscribers = new Set<Subscriber>();
const history: LogEntry[] = [];
const MAX_HISTORY = 200;

const consoleMap: Record<LogLevel, (...args: any[]) => void> = {
  debug: (...args) => (console.debug ? console.debug(...args) : console.log(...args)),
  info: (...args) => console.info ? console.info(...args) : console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const emit = (entry: LogEntry) => {
  history.push(entry);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  for (const subscriber of subscribers) {
    try {
      subscriber(entry);
    } catch (error) {
      console.error('Logger subscriber threw error', error);
    }
  }
};

const logInternal = (level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) => {
  const payload: LogEntry = {
    level,
    message,
    timestamp: Date.now(),
    context,
    error,
  };

  const consoleFn = consoleMap[level];
  const args: unknown[] = [message];
  if (context) {
    args.push(context);
  }
  if (error) {
    args.push(error);
  }
  consoleFn(...args);

  emit(payload);
};

export const Logger = {
  debug: (message: string, context?: Record<string, unknown>) => logInternal('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => logInternal('info', message, context),
  warn: (message: string, context?: Record<string, unknown>, error?: unknown) => logInternal('warn', message, context, error),
  error: (message: string, context?: Record<string, unknown>, error?: unknown) => logInternal('error', message, context, error),
  log: logInternal,
  subscribe: (subscriber: Subscriber) => {
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  },
  getHistory: () => [...history],
  clearHistory: () => {
    history.length = 0;
  },
};

