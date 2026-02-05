import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEvents } from '../events';
import { EventBus } from '../events';
import { Tools } from '../utils';
import { DomEventsController } from './DomEventsController';
import { DrawingController } from './DrawingController';

vi.mock('../events/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn(() => ({
      emit: vi.fn(),
    })),
  },
}));

vi.mock('./DrawingController', () => ({
  DrawingController: {
    getInstance: vi.fn(() => ({
      isErasing: false,
    })),
  },
}));

describe('DomEventsController', () => {
  let mockEventBus: any;
  let mockDrawingController: any;

  const keydownListeners: ((e: KeyboardEvent) => void)[] = [];
  const keyupListeners: ((e: KeyboardEvent) => void)[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    mockEventBus = {
      emit: vi.fn(),
    };
    vi.mocked(EventBus.getInstance).mockReturnValue(mockEventBus);

    mockDrawingController = {
      isErasing: false,
    };
    vi.mocked(DrawingController.getInstance).mockReturnValue(
      mockDrawingController
    );

    keydownListeners.length = 0;
    keyupListeners.length = 0;

    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, listener: any) => {
        if (event === 'keydown') {
          keydownListeners.push(listener as (e: KeyboardEvent) => void);
        } else if (event === 'keyup') {
          keyupListeners.push(listener as (e: KeyboardEvent) => void);
        }
      }
    );
  });

  afterEach(() => {
    (DomEventsController as any).instance = undefined;
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls to getInstance', () => {
      const instance1 = DomEventsController.getInstance();
      const instance2 = DomEventsController.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create a new instance only once', () => {
      const instance1 = DomEventsController.getInstance();
      const instance2 = DomEventsController.getInstance();
      const instance3 = DomEventsController.getInstance();

      expect(instance1 === instance2).toBe(true);
      expect(instance2 === instance3).toBe(true);
    });
  });

  describe('Constructor', () => {
    it('should call _initEvents on instantiation', () => {
      DomEventsController.getInstance();
      expect(window.addEventListener).toHaveBeenCalledTimes(2);
    });

    it('should add keydown event listener', () => {
      DomEventsController.getInstance();
      expect(window.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should add keyup event listener', () => {
      DomEventsController.getInstance();
      expect(window.addEventListener).toHaveBeenCalledWith(
        'keyup',
        expect.any(Function)
      );
    });
  });

  describe('_onKeyDown', () => {
    beforeEach(() => {
      DomEventsController.getInstance();
    });

    it('should call preventDefault for "e" key', () => {
      const event = new KeyboardEvent('keydown', { key: 'e' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for "z" key', () => {
      const event = new KeyboardEvent('keydown', { key: 'z' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for "Delete" key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for "+" key', () => {
      const event = new KeyboardEvent('keydown', { key: '+' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for "-" key', () => {
      const event = new KeyboardEvent('keydown', { key: '-' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for space key', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should NOT call preventDefault for non-mapped keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keydownListeners[0](event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    describe('Key: "e" (Toggle Eraser)', () => {
      it('should emit DRAWING_SET_TOOL with ERASER when isErasing is false', () => {
        mockDrawingController.isErasing = false;
        const event = new KeyboardEvent('keydown', { key: 'e' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.DRAWING_SET_TOOL,
          Tools.ERASER
        );
      });

      it('should emit DRAWING_SET_TOOL with BRUSH when isErasing is true', () => {
        mockDrawingController.isErasing = true;
        const event = new KeyboardEvent('keydown', { key: 'e' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.DRAWING_SET_TOOL,
          Tools.BRUSH
        );
      });

      it('should handle uppercase "E"', () => {
        mockDrawingController.isErasing = false;
        const event = new KeyboardEvent('keydown', { key: 'E' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.DRAWING_SET_TOOL,
          Tools.ERASER
        );
      });
    });

    describe('Key: "z" (Undo/Redo)', () => {
      it('should emit HISTORY_UNDO when Ctrl+Z is pressed', () => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
        });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.HISTORY_UNDO,
          null
        );
      });

      it('should emit HISTORY_UNDO when Cmd+Z is pressed (Mac)', () => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
        });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.HISTORY_UNDO,
          null
        );
      });

      it('should emit HISTORY_REDO when Ctrl+Shift+Z is pressed', () => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
        });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.HISTORY_REDO,
          null
        );
      });

      it('should emit HISTORY_REDO when Cmd+Shift+Z is pressed (Mac)', () => {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          metaKey: true,
          shiftKey: true,
        });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.HISTORY_REDO,
          null
        );
      });

      it('should NOT emit any event when Z is pressed without modifiers', () => {
        const event = new KeyboardEvent('keydown', { key: 'z' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).not.toHaveBeenCalledWith(
          AppEvents.HISTORY_UNDO,
          null
        );
        expect(mockEventBus.emit).not.toHaveBeenCalledWith(
          AppEvents.HISTORY_REDO,
          null
        );
      });

      it('should handle uppercase "Z"', () => {
        const event = new KeyboardEvent('keydown', {
          key: 'Z',
          ctrlKey: true,
        });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.HISTORY_UNDO,
          null
        );
      });
    });

    describe('Key: "Delete" (Clear Layer)', () => {
      it('should emit LAYER_CLEAR_ACTIVE when Delete is pressed', () => {
        const event = new KeyboardEvent('keydown', { key: 'Delete' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.LAYER_CLEAR_ACTIVE,
          null
        );
      });

      it('should handle lowercase "delete"', () => {
        const event = new KeyboardEvent('keydown', { key: 'delete' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.LAYER_CLEAR_ACTIVE,
          null
        );
      });
    });

    describe('Key: "+" (Zoom In)', () => {
      it('should emit CANVAS_ZOOM_IN when + is pressed', () => {
        const event = new KeyboardEvent('keydown', { key: '+' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.CANVAS_ZOOM_IN,
          null
        );
      });
    });

    describe('Key: "-" (Zoom Out)', () => {
      it('should emit CANVAS_ZOOM_OUT when - is pressed', () => {
        const event = new KeyboardEvent('keydown', { key: '-' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.CANVAS_ZOOM_OUT,
          null
        );
      });
    });

    describe('Key: " " (Space - Pan Mode)', () => {
      it('should emit CANVAS_SET_PAN_MODE with true when space is pressed', () => {
        const event = new KeyboardEvent('keydown', { key: ' ' });

        keydownListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.CANVAS_SET_PAN_MODE,
          true
        );
      });
    });
  });

  describe('_onKeyUp', () => {
    beforeEach(() => {
      DomEventsController.getInstance();
    });

    it('should call preventDefault for space key', () => {
      const event = new KeyboardEvent('keyup', { key: ' ' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyupListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should NOT emit any event for non-mapped keys on keyup', () => {
      const event = new KeyboardEvent('keyup', { key: 'e' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      keyupListeners[0](event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    describe('Key: " " (Space - Disable Pan Mode)', () => {
      it('should emit CANVAS_SET_PAN_MODE with false when space is released', () => {
        const event = new KeyboardEvent('keyup', { key: ' ' });

        keyupListeners[0](event);

        expect(mockEventBus.emit).toHaveBeenCalledWith(
          AppEvents.CANVAS_SET_PAN_MODE,
          false
        );
      });
    });
  });
});
