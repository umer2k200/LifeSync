import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, type LogEntry } from '@/lib/logger';

describe('Logger', () => {
  afterEach(() => {
    Logger.clearHistory();
    vi.restoreAllMocks();
  });

  it('notifies subscribers and keeps bounded history', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const entries: LogEntry[] = [];
    const unsubscribe = Logger.subscribe((entry) => {
      entries.push(entry);
    });

    Logger.info('test message', { feature: 'unit-test' });
    unsubscribe();

    expect(infoSpy).toHaveBeenCalledWith('test message', { feature: 'unit-test' });
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('test message');
    expect(entries[0].level).toBe('info');

    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe('test message');
  });

  it('limits history to 200 entries', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    for (let i = 0; i < 250; i += 1) {
      Logger.debug(`entry-${i}`);
    }

    const history = Logger.getHistory();
    expect(history.length).toBeLessThanOrEqual(200);
    expect(history[0].message).toBe('entry-50');
    expect(history.at(-1)?.message).toBe('entry-249');
  });
});

