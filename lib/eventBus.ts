type Listener<Payload> = (payload: Payload) => void;

export class EventBus<EventMap extends Record<string, any>> {
  private listeners = new Map<keyof EventMap, Set<Listener<any>>>();

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // Create a copy to avoid mutations during iteration
    const listenersToNotify = Array.from(listeners);
    for (const listener of listenersToNotify) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error emitting event "${String(event)}":`, error);
      }
    }
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }

    listeners.add(listener);

    return () => {
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  removeAllListeners<K extends keyof EventMap>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

type AppEventMap = {
  onboardingCompleted: undefined;
};

export const AppEventBus = new EventBus<AppEventMap>();

