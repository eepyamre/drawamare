import { RenderTexture } from 'pixi.js';

import { Layer } from './';

export type History = RenderTexture[];

export interface IHistoryController {
  initBusListeners(): void;
  saveState(activeLayer: Layer | null): void;
  undo(): void;
  redo(): void;
  clearHistory(): void;
  clearRedo(): void;
}
