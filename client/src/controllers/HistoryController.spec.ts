import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEvents } from '../events/AppEvents';
import type { Layer } from '../interfaces';
import { HistoryController } from './HistoryController';

const mockEventBusInstance = {
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
};

const mockLayerControllerInstance = {
  getActiveLayer: vi.fn(),
};

const mockPixiControllerInstance = {
  extractTexture: vi.fn(),
  redrawLayer: vi.fn(),
  extractBase64: vi.fn(),
};

vi.mock('../events/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn(() => mockEventBusInstance),
  },
}));

vi.mock('./LayerController', () => ({
  LayerController: {
    getInstance: vi.fn(() => mockLayerControllerInstance),
  },
}));

vi.mock('./PixiController', () => ({
  PixiController: {
    getInstance: vi.fn(() => mockPixiControllerInstance),
  },
}));

describe('HistoryController', () => {
  let mockLayer: Layer;
  let mockRenderTexture: any;

  beforeEach(() => {
    mockEventBusInstance.on.mockReset();
    mockEventBusInstance.emit.mockReset();
    mockLayerControllerInstance.getActiveLayer.mockReset();
    mockPixiControllerInstance.extractTexture.mockReset();
    mockPixiControllerInstance.redrawLayer.mockReset();
    mockPixiControllerInstance.extractBase64.mockReset();

    mockPixiControllerInstance.extractBase64.mockResolvedValue(
      'mock-base64-data'
    );

    mockRenderTexture = {
      id: 'mock-texture-1',
    };

    mockLayer = {
      id: 1,
      container: {} as any,
      rt: mockRenderTexture,
      ownerId: 'mock-owner' as any,
      ownerName: 'Test Owner',
      title: 'Test Layer',
    };

    (HistoryController as any).instance = null;
    (HistoryController as any).historyStack = [];
    (HistoryController as any).redoStack = [];
  });

  afterEach(() => {
    (HistoryController as any).instance = null;
    (HistoryController as any).historyStack = [];
    (HistoryController as any).redoStack = [];
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = HistoryController.getInstance();
      const instance2 = HistoryController.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create a new instance on first call', () => {
      const instance = HistoryController.getInstance();

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(HistoryController);
    });
  });

  describe('Event Bus Listeners', () => {
    it('should register event listeners in constructor', () => {
      HistoryController.getInstance();

      expect(mockEventBusInstance.on).toHaveBeenCalledWith(
        AppEvents.HISTORY_SAVE_STATE,
        expect.any(Function)
      );
      expect(mockEventBusInstance.on).toHaveBeenCalledWith(
        AppEvents.HISTORY_CLEAR_REDO,
        expect.any(Function)
      );
      expect(mockEventBusInstance.on).toHaveBeenCalledWith(
        AppEvents.HISTORY_CLEAR_UNDO,
        expect.any(Function)
      );
      expect(mockEventBusInstance.on).toHaveBeenCalledWith(
        AppEvents.HISTORY_UNDO,
        expect.any(Function)
      );
      expect(mockEventBusInstance.on).toHaveBeenCalledWith(
        AppEvents.HISTORY_REDO,
        expect.any(Function)
      );
    });

    it('should call initBusListeners in constructor', () => {
      const initBusListenersSpy = vi.spyOn(
        HistoryController.prototype,
        'initBusListeners'
      );

      HistoryController.getInstance();

      expect(initBusListenersSpy).toHaveBeenCalled();
    });
  });

  describe('saveState', () => {
    it('should save layer state to history stack', () => {
      const controller = HistoryController.getInstance();
      mockPixiControllerInstance.extractTexture.mockReturnValue(
        mockRenderTexture
      );

      controller.saveState(mockLayer);

      expect(mockPixiControllerInstance.extractTexture).toHaveBeenCalledWith(
        mockLayer
      );
      expect((HistoryController as any).historyStack).toHaveLength(1);
      expect((HistoryController as any).historyStack[0]).toBe(
        mockRenderTexture
      );
    });

    it('should return early if no active layer provided', () => {
      const controller = HistoryController.getInstance();

      controller.saveState(null as any);

      expect(mockPixiControllerInstance.extractTexture).not.toHaveBeenCalled();
      expect((HistoryController as any).historyStack).toHaveLength(0);
    });

    it('should handle multiple state saves', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };
      const texture3 = { id: 'mock-texture-3' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2)
        .mockReturnValueOnce(texture3);

      controller.saveState(mockLayer);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      expect((HistoryController as any).historyStack).toHaveLength(3);
      expect((HistoryController as any).historyStack[0]).toBe(texture1);
      expect((HistoryController as any).historyStack[1]).toBe(texture2);
      expect((HistoryController as any).historyStack[2]).toBe(texture3);
    });

    it('should limit history stack to maxHistoryLength', () => {
      const controller = HistoryController.getInstance();
      const maxHistoryLength = 48;

      for (let i = 0; i < 50; i++) {
        const texture = { id: `mock-texture-${i}` };
        mockPixiControllerInstance.extractTexture.mockReturnValue(texture);
        controller.saveState(mockLayer);
      }

      const historyStack = (HistoryController as any).historyStack;
      expect(historyStack).toHaveLength(maxHistoryLength);
      expect(historyStack[0].id).toBe('mock-texture-2');
      expect(historyStack[maxHistoryLength - 1].id).toBe('mock-texture-49');
    });

    it('should handle exactly maxHistoryLength states', () => {
      const controller = HistoryController.getInstance();
      const maxHistoryLength = 48;

      for (let i = 0; i < maxHistoryLength; i++) {
        const texture = { id: `mock-texture-${i}` };
        mockPixiControllerInstance.extractTexture.mockReturnValue(texture);
        controller.saveState(mockLayer);
      }

      expect((HistoryController as any).historyStack).toHaveLength(
        maxHistoryLength
      );
    });
  });

  describe('undo', () => {
    it('should pop from history stack and push to redo stack', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.undo();

      expect((HistoryController as any).historyStack).toHaveLength(1);
      expect((HistoryController as any).redoStack).toHaveLength(1);
      expect((HistoryController as any).redoStack[0]).toBe(texture2);
    });

    it('should redraw layer with previous state', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.undo();

      expect(mockPixiControllerInstance.redrawLayer).toHaveBeenCalledWith(
        mockLayer,
        texture1
      );
    });

    it('should emit network save layer event', async () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      await controller.undo();

      expect(mockEventBusInstance.emit).toHaveBeenCalledWith(
        AppEvents.NETWORK_SAVE_LAYER,
        {
          layerId: mockLayer.id,
          base64: 'mock-base64-data',
          forceUpdate: true,
        }
      );
    });

    it('should return early if history stack is empty', () => {
      const controller = HistoryController.getInstance();
      const consoleSpy = vi.spyOn(console, 'log');

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.undo();

      expect(consoleSpy).toHaveBeenCalledWith('No commands to undo');
      expect(mockPixiControllerInstance.redrawLayer).not.toHaveBeenCalled();
    });

    it('should return early if no active layer exists', () => {
      const controller = HistoryController.getInstance();
      const consoleSpy = vi.spyOn(console, 'log');
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(null);

      controller.undo();

      expect(consoleSpy).toHaveBeenCalledWith('No layer selected');
      expect(mockPixiControllerInstance.redrawLayer).not.toHaveBeenCalled();
      expect((HistoryController as any).historyStack).toHaveLength(2);
    });
  });

  describe('redo', () => {
    it('should pop from redo stack and push to history stack', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      mockPixiControllerInstance.redrawLayer.mockReset();
      mockEventBusInstance.emit.mockReset();

      controller.redo();

      expect((HistoryController as any).historyStack).toHaveLength(2);
      expect((HistoryController as any).redoStack).toHaveLength(0);
      expect((HistoryController as any).historyStack[1]).toBe(texture2);
    });

    it('should redraw layer with redone state', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      mockPixiControllerInstance.redrawLayer.mockReset();

      controller.redo();

      expect(mockPixiControllerInstance.redrawLayer).toHaveBeenCalledWith(
        mockLayer,
        texture2
      );
    });

    it('should emit network save layer event', async () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      mockEventBusInstance.emit.mockReset();

      await controller.redo();

      expect(mockEventBusInstance.emit).toHaveBeenCalledWith(
        AppEvents.NETWORK_SAVE_LAYER,
        {
          layerId: mockLayer.id,
          base64: 'mock-base64-data',
          forceUpdate: true,
        }
      );
    });

    it('should return early if redo stack is empty', () => {
      const controller = HistoryController.getInstance();
      const consoleSpy = vi.spyOn(console, 'log');

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.redo();

      expect(consoleSpy).toHaveBeenCalledWith('No commands to redo');
      expect(mockPixiControllerInstance.redrawLayer).not.toHaveBeenCalled();
    });

    it('should return early if no active layer exists', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      expect((HistoryController as any).redoStack).toHaveLength(1);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(null);

      controller.redo();

      expect((HistoryController as any).redoStack).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear the history stack', () => {
      const controller = HistoryController.getInstance();
      const texture = { id: 'mock-texture-1' };

      mockPixiControllerInstance.extractTexture.mockReturnValue(texture);
      controller.saveState(mockLayer);

      expect((HistoryController as any).historyStack).toHaveLength(1);

      controller.clearHistory();

      expect((HistoryController as any).historyStack).toHaveLength(0);
    });

    it('should handle clearing empty history', () => {
      const controller = HistoryController.getInstance();

      controller.clearHistory();

      expect((HistoryController as any).historyStack).toHaveLength(0);
    });

    it('should handle clearing history with multiple items', () => {
      const controller = HistoryController.getInstance();

      for (let i = 0; i < 5; i++) {
        const texture = { id: `mock-texture-${i}` };
        mockPixiControllerInstance.extractTexture.mockReturnValue(texture);
        controller.saveState(mockLayer);
      }

      expect((HistoryController as any).historyStack).toHaveLength(5);

      controller.clearHistory();

      expect((HistoryController as any).historyStack).toHaveLength(0);
    });
  });

  describe('clearRedo', () => {
    it('should clear the redo stack', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      expect((HistoryController as any).redoStack).toHaveLength(1);

      controller.clearRedo();

      expect((HistoryController as any).redoStack).toHaveLength(0);
    });

    it('should handle clearing empty redo stack', () => {
      const controller = HistoryController.getInstance();

      controller.clearRedo();

      expect((HistoryController as any).redoStack).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple undo operations', () => {
      const controller = HistoryController.getInstance();
      const textures = [
        { id: 'mock-texture-1' },
        { id: 'mock-texture-2' },
        { id: 'mock-texture-3' },
      ];

      textures.forEach((texture) => {
        mockPixiControllerInstance.extractTexture.mockReturnValue(texture);
        controller.saveState(mockLayer);
      });

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.undo();
      expect((HistoryController as any).historyStack).toHaveLength(2);

      controller.undo();
      expect((HistoryController as any).historyStack).toHaveLength(1);
    });

    it('should handle undo followed by redo', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);

      controller.undo();
      expect((HistoryController as any).historyStack).toHaveLength(1);
      expect((HistoryController as any).redoStack).toHaveLength(1);

      controller.redo();
      expect((HistoryController as any).historyStack).toHaveLength(2);
      expect((HistoryController as any).redoStack).toHaveLength(0);
    });

    it('should preserve redo stack on new state after undo (no auto-clear)', () => {
      const controller = HistoryController.getInstance();
      const texture1 = { id: 'mock-texture-1' };
      const texture2 = { id: 'mock-texture-2' };
      const texture3 = { id: 'mock-texture-3' };

      mockPixiControllerInstance.extractTexture
        .mockReturnValueOnce(texture1)
        .mockReturnValueOnce(texture2);
      controller.saveState(mockLayer);
      controller.saveState(mockLayer);

      mockLayerControllerInstance.getActiveLayer.mockReturnValue(mockLayer);
      controller.undo();

      expect((HistoryController as any).redoStack).toHaveLength(1);

      mockPixiControllerInstance.extractTexture.mockReturnValue(texture3);
      controller.saveState(mockLayer);

      expect((HistoryController as any).redoStack).toHaveLength(1);
      expect((HistoryController as any).historyStack).toHaveLength(2);
    });
  });

  describe('Event-Driven Operations', () => {
    it('should call saveState when HISTORY_SAVE_STATE event is emitted', () => {
      const saveStateSpy = vi.spyOn(HistoryController.prototype, 'saveState');
      HistoryController.getInstance();

      const onCall = mockEventBusInstance.on.mock.calls.find(
        (call: any[]) => call[0] === AppEvents.HISTORY_SAVE_STATE
      );
      const handler = onCall?.[1];

      if (handler) {
        handler(mockLayer);
        expect(saveStateSpy).toHaveBeenCalledWith(mockLayer);
      }
    });

    it('should call clearRedo when HISTORY_CLEAR_REDO event is emitted', () => {
      // Spy before getting instance so spy intercepts binding
      const clearRedoSpy = vi.spyOn(HistoryController.prototype, 'clearRedo');
      HistoryController.getInstance();

      const onCall = mockEventBusInstance.on.mock.calls.find(
        (call: any[]) => call[0] === AppEvents.HISTORY_CLEAR_REDO
      );
      const handler = onCall?.[1];

      if (handler) {
        handler(null);
        expect(clearRedoSpy).toHaveBeenCalled();
      }
    });

    it('should call clearHistory when HISTORY_CLEAR_UNDO event is emitted', () => {
      const clearHistorySpy = vi.spyOn(
        HistoryController.prototype,
        'clearHistory'
      );
      HistoryController.getInstance();

      const onCall = mockEventBusInstance.on.mock.calls.find(
        (call: any[]) => call[0] === AppEvents.HISTORY_CLEAR_UNDO
      );
      const handler = onCall?.[1];

      if (handler) {
        handler(null);
        expect(clearHistorySpy).toHaveBeenCalled();
      }
    });

    it('should register undo handler for HISTORY_UNDO event', () => {
      HistoryController.getInstance();

      const onCall = mockEventBusInstance.on.mock.calls.find(
        (call: any[]) => call[0] === AppEvents.HISTORY_UNDO
      );
      const handler = onCall?.[1];

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should register redo handler for HISTORY_REDO event', () => {
      HistoryController.getInstance();

      const onCall = mockEventBusInstance.on.mock.calls.find(
        (call: any[]) => call[0] === AppEvents.HISTORY_REDO
      );
      const handler = onCall?.[1];

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });
});
