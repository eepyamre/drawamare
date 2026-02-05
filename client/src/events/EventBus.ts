import { AppEvents, EventData } from './AppEvents';

export type EventHandler<T> = (data: T) => void;

type Listeners = {
  [K in AppEvents]?: Set<EventHandler<EventData[K]>>;
};

export class EventBus {
  private static instance: EventBus;
  private listeners: Listeners = {};

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  on<K extends AppEvents>(event: K, handler: EventHandler<EventData[K]>) {
    console.log(`[EventBus] Subscribed to ${event}`);

    const set = this.listeners[event] ?? new Set<EventHandler<EventData[K]>>();
    set.add(handler);

    this.listeners[event] = set as Listeners[K];
  }

  off<K extends AppEvents>(event: K, handler: EventHandler<EventData[K]>) {
    console.log(`[EventBus] Unsubscribed from ${event}`);

    const set = this.listeners[event] ?? new Set<EventHandler<EventData[K]>>();
    set.delete(handler);

    this.listeners[event] = set as Listeners[K];
  }

  emit<K extends AppEvents>(event: K, data: EventData[K]) {
    console.log(`[EventBus] Emitted ${event}`);

    const listeners = this.listeners[event];

    listeners?.forEach((fn) => fn(data));
  }
}
