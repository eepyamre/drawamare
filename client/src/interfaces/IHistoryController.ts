import { RenderTexture } from 'pixi.js';

import {
  ILayerController,
  INetworkController,
  IPixiController,
  Layer,
} from './';

export type History = RenderTexture[];

export interface IHistoryController {
  historyStack: History;
  redoStack: History;

  saveState(pixiCtr: IPixiController, activeLayer: Layer): void;
  undo(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    networkCtr: INetworkController
  ): void;
  redo(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    networkCtr: INetworkController
  ): void;
  clearHistory(): void;
  clearRedo(): void;
}
