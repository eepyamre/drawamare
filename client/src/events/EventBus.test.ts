import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AppEvents } from './AppEvents';
import { EventBus } from './EventBus';

describe('EventBus', () => {
  beforeEach(() => {
    (EventBus as any)['instance'] = null;
  });

  test('getInstance should return singleton', () => {
    const bus1 = EventBus.getInstance();
    const bus2 = EventBus.getInstance();
    expect(bus1).toBe(bus2);
  });

  test('on should add listener', () => {
    const bus = EventBus.getInstance();
    const handler = vi.fn();
    const event = AppEvents.LAYER_ACTIVATED;

    bus.on(event, handler);

    expect(bus['listeners'].get(event)).toHaveLength(1);
  });

  test('on should remove listener', () => {
    const bus = EventBus.getInstance();
    const handler = vi.fn();
    const event = AppEvents.LAYER_ACTIVATED;

    bus.on(event, handler);

    expect(bus['listeners'].get(event)).toHaveLength(1);

    bus.off(event, handler);

    expect(bus['listeners'].get(event)).toHaveLength(0);
  });

  test('data is passed', () => {
    const bus = EventBus.getInstance();
    const handler = vi.fn();
    const event = AppEvents.LAYER_ACTIVATED;
    const data = 1;

    bus.on(event, handler);

    expect(bus['listeners'].get(event)).toHaveLength(1);
    bus.emit(event, data);
    expect(handler).toHaveBeenCalledWith(data);

    bus.off(event, handler);

    expect(bus['listeners'].get(event)).toHaveLength(0);
  });

  test('should support multiple listeners', () => {
    const bus = EventBus.getInstance();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event = AppEvents.LAYER_ACTIVATED;

    bus.on(event, handler1);
    bus.on(event, handler2);

    expect(handler1).toHaveBeenCalledTimes(0);
    expect(handler2).toHaveBeenCalledTimes(0);

    expect(bus['listeners'].get(event)).toHaveLength(2);

    bus.emit(event, 1);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('should not call different events', () => {
    const bus = EventBus.getInstance();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event1 = AppEvents.LAYER_ACTIVATED;
    const event2 = AppEvents.LAYERS_RERENDER;

    bus.on(event1, handler1);
    bus.on(event2, handler2);

    expect(handler1).toHaveBeenCalledTimes(0);
    expect(handler2).toHaveBeenCalledTimes(0);

    expect(bus['listeners'].get(event1)).toHaveLength(1);
    expect(bus['listeners'].get(event2)).toHaveLength(1);

    bus.emit(AppEvents.LAYER_ACTIVATED, 1);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(0);

    bus.off(event1, handler1);
    bus.off(event2, handler2);
  });
});
