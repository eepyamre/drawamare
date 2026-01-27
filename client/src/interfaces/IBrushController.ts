import { Point, Sprite } from 'pixi.js';

import { BLEND_MODES, Brush, BrushExtended } from '../utils';
import { IPixiController, Layer } from './';

export type StampFn = (
  pixiCtr: IPixiController,
  layer: Layer,
  brush: Brush,
  position: Point,
  diameter: number,
  color: number,
  alpha: number,
  blendMode: BLEND_MODES,
  clearCache: boolean
) => void;

export interface IBrushController {
  brush: Brush;
  // string of <angle><density><ratio><spikes><spacing><size><color>
  stampCache: Record<string, Sprite>;

  drawStamp: StampFn;
  saveCache(brush: BrushExtended, sprite: Sprite): void;
  getCacheName(brush: BrushExtended): void;
  clearCache(brush: BrushExtended): void;
  setBrush(newBrush: Brush): void;
}
