import { AppEvents, EventBus } from '../events';
import { Layer } from '../interfaces';
import { History, IHistoryController } from '../interfaces/IHistoryController';
import { LayerController } from './LayerController';
import { PixiController } from './PixiController';

const maxHistoryLength = 48;

export class HistoryController implements IHistoryController {
  private static instance: IHistoryController;
  private static historyStack: History = [];
  private static redoStack: History = [];

  constructor() {
    this.initBusListeners();
  }

  static getInstance(): IHistoryController {
    if (!this.instance) {
      this.instance = new HistoryController();
    }

    return this.instance;
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.HISTORY_SAVE_STATE, this.saveState.bind(this));
    bus.on(AppEvents.HISTORY_CLEAR_REDO, this.clearRedo.bind(this));
    bus.on(AppEvents.HISTORY_CLEAR_UNDO, this.clearHistory.bind(this));
    bus.on(AppEvents.HISTORY_UNDO, this.undo.bind(this));
    bus.on(AppEvents.HISTORY_REDO, this.redo.bind(this));
  }

  saveState(activeLayer: Layer) {
    if (!activeLayer) return;

    HistoryController.historyStack.push(
      PixiController.getInstance().extractTexture(activeLayer)
    );

    if (HistoryController.historyStack.length > maxHistoryLength) {
      HistoryController.historyStack =
        HistoryController.historyStack.slice(-maxHistoryLength);
    }
  }

  undo() {
    if (HistoryController.historyStack.length <= 0) {
      console.log('No commands to undo');
      return;
    }
    const layer = LayerController.getInstance().getActiveLayer();
    if (!layer) {
      console.log('No layer selected');
      return;
    }

    const lastItem = HistoryController.historyStack.pop();

    if (!lastItem) {
      console.log('Stack is empty');
      return;
    }
    HistoryController.redoStack.push(lastItem);
    const previousState =
      HistoryController.historyStack[HistoryController.historyStack.length - 1];
    PixiController.getInstance().redrawLayer(layer, previousState);
    PixiController.getInstance()
      .extractBase64(layer.rt)
      .then((data) => {
        EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
          layerId: layer.id,
          base64: data,
          forceUpdate: true,
        });
      });
  }

  redo() {
    if (HistoryController.redoStack.length <= 0) {
      console.log('No commands to redo');
      return;
    }

    const layer = LayerController.getInstance().getActiveLayer();
    if (!layer) return;

    const lastItem = HistoryController.redoStack.pop();
    if (lastItem) {
      HistoryController.historyStack.push(lastItem);
      PixiController.getInstance().redrawLayer(layer, lastItem);
      PixiController.getInstance()
        .extractBase64(layer.rt)
        .then((data) => {
          EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
            layerId: layer.id,
            base64: data,
            forceUpdate: true,
          });
        });
    }
  }

  clearHistory() {
    HistoryController.historyStack = [];
  }

  clearRedo() {
    HistoryController.redoStack = [];
  }
}
