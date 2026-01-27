import { RenderTexture } from 'pixi.js';

import { ILayerController, IPixiController, Layer } from './';

export type History = RenderTexture[];

export interface IHistoryController {
  historyStack: History;
  redoStack: History;

  saveState(pixiCtr: IPixiController, activeLayer: Layer): void;
  undo(pixiCtr: IPixiController, layerCtr: ILayerController): void;
  redo(pixiCtr: IPixiController, layerCtr: ILayerController): void;
  clearHistory(): void;
  clearRedo(): void;
}
