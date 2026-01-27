import { AppEvents, EventData } from './AppEvents';

export type EventHandler<T> = (data: T) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners = new Map<AppEvents, Set<EventHandler<any>>>();

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }

    return this.instance;
  }

  on<K extends keyof EventData>(event: K, handler: EventHandler<EventData[K]>) {
    console.log(`[EventBus] Subscribed to ${event}`);
    const set = this.listeners.get(event) ?? new Set([]);
    set.add(handler);
    this.listeners.set(event, set);
  }

  off<K extends keyof EventData>(
    event: K,
    handler: EventHandler<EventData[K]>
  ) {
    console.log(`[EventBus] Unsubscribed from ${event}`);
    const set = this.listeners.get(event) ?? new Set([]);
    set.delete(handler);
    this.listeners.set(event, set);
  }

  emit<K extends keyof EventData>(event: K, data: EventData[K]) {
    console.log(`[EventBus] Emitted ${event}`);
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}
