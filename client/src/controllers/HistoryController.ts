import { AppEvents, EventBus } from '../events';
import { IPixiController, Layer } from '../interfaces';
import { History, IHistoryController } from '../interfaces/IHistoryController';
import { LayerController } from './LayerController';

const maxHistoryLength = 48;

export class HistoryController implements IHistoryController {
  historyStack: History = [];
  redoStack: History = [];
  pixiCtr: IPixiController;

  constructor(pixiCtr: IPixiController) {
    this.pixiCtr = pixiCtr;
    this.initBusListeners();
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.HISTORY_SAVE_STATE, this.saveState.bind(this));
    bus.on(AppEvents.HISTORY_CLEAR_REDO, this.clearRedo.bind(this));
    bus.on(AppEvents.HISTORY_CLEAR_UNDO, this.clearHistory.bind(this));
  }

  saveState(activeLayer: Layer) {
    if (!activeLayer) return;

    this.historyStack.push(this.pixiCtr.extractTexture(activeLayer));

    if (this.historyStack.length > maxHistoryLength) {
      this.historyStack = this.historyStack.slice(-maxHistoryLength);
    }
  }

  undo(layerCtr: LayerController) {
    if (this.historyStack.length <= 1) {
      console.log('No commands to undo');
      return;
    }
    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    const lastItem = this.historyStack.pop();
    if (lastItem) {
      this.redoStack.push(lastItem);
      const previousState = this.historyStack[this.historyStack.length - 1];
      this.pixiCtr.redrawLayer(layer, previousState);
      this.pixiCtr.extractBase64(layer.rt).then((data) => {
        EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
          layerId: layer.id,
          base64: data,
          forceUpdate: true,
        });
      });
    }
  }

  redo(layerCtr: LayerController) {
    if (this.redoStack.length <= 0) {
      console.log('No commands to redo');
      return;
    }

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    const lastItem = this.redoStack.pop();
    if (lastItem) {
      this.historyStack.push(lastItem);
      this.pixiCtr.redrawLayer(layer, lastItem);
      this.pixiCtr.extractBase64(layer.rt).then((data) => {
        EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
          layerId: layer.id,
          base64: data,
          forceUpdate: true,
        });
      });
    }
  }

  clearHistory() {
    this.historyStack = [];
  }

  clearRedo() {
    this.redoStack = [];
  }
}
