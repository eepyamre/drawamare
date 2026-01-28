import { RenderTexture } from 'pixi.js';

import { ILayerController, IPixiController, Layer } from './';

export type History = RenderTexture[];

export interface IHistoryController {
  pixiCtr: IPixiController;
  historyStack: History;
  redoStack: History;

  initBusListeners(): void;
  saveState(activeLayer: Layer): void;
  undo(layerCtr: ILayerController): void;
  redo(layerCtr: ILayerController): void;
  clearHistory(): void;
  clearRedo(): void;
}
