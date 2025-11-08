import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventBus } from '@/lib/eventBus';

type TestEvents = {
  ping: string;
  done: undefined;
};

describe('EventBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notifies listeners with payload', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('ping', listener);

    bus.emit('ping', 'hello');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('supports once subscriptions', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    bus.once('ping', listener);

    bus.emit('ping', 'first');
    bus.emit('ping', 'second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('removes listeners via dispose function', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();

    const unsubscribe = bus.on('ping', listener);
    unsubscribe();

    bus.emit('ping', 'after-unsubscribe');

    expect(listener).not.toHaveBeenCalled();
  });
});

