import { AppEvents, EventBus } from '../events';
import { Layer } from '../interfaces';
import { History, IHistoryController } from '../interfaces/IHistoryController';
import { LayerController } from './LayerController';
import { PixiController } from './PixiController';

const maxHistoryLength = 48;

export class HistoryController implements IHistoryController {
  historyStack: History = [];
  redoStack: History = [];

  saveState(pixiCtr: PixiController, activeLayer: Layer) {
    if (!activeLayer) return;

    this.historyStack.push(pixiCtr.extractTexture(activeLayer));

    if (this.historyStack.length > maxHistoryLength) {
      this.historyStack = this.historyStack.slice(-maxHistoryLength);
    }
  }

  undo(pixiCtr: PixiController, layerCtr: LayerController) {
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
      pixiCtr.redrawLayer(layer, previousState);
      pixiCtr.extractBase64(layer.rt).then((data) => {
        EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
          layerId: layer.id,
          base64: data,
          forceUpdate: true,
        });
      });
    }
  }

  redo(pixiCtr: PixiController, layerCtr: LayerController) {
    if (this.redoStack.length <= 0) {
      console.log('No commands to redo');
      return;
    }

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    const lastItem = this.redoStack.pop();
    if (lastItem) {
      this.historyStack.push(lastItem);
      pixiCtr.redrawLayer(layer, lastItem);
      pixiCtr.extractBase64(layer.rt).then((data) => {
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
