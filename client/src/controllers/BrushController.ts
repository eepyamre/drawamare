import { Sprite } from 'pixi.js';

import { AppEvents, EventBus } from '../events';
import { IBrushController, StampFn } from '../interfaces';
import { BLEND_MODES, Brush, BrushExtended, DEFAULT_BRUSH } from '../utils';
import { BrushEngine } from './BrushEngine';
import { PixiController } from './PixiController';

export class BrushController implements IBrushController {
  private static instance: IBrushController;
  brush: Brush = DEFAULT_BRUSH;
  // string of <angle><density><ratio><spikes><spacing><size><color>
  stampCache: Record<string, Sprite> = {};

  constructor() {
    EventBus.getInstance().on(AppEvents.BRUSH_EDITOR_SAVE, ({ brush }) => {
      this.setBrush(brush);
    });
    EventBus.getInstance().on(AppEvents.BRUSH_CHANGE, this.setBrush.bind(this));
  }

  static getInstance(): IBrushController {
    if (!this.instance) {
      this.instance = new BrushController();
    }

    return this.instance;
  }

  saveCache(brush: BrushExtended, sprite: Sprite) {
    this.stampCache[this.getCacheName(brush)] = sprite;
  }

  getCacheName(brush: BrushExtended) {
    return `${brush.type}${brush.angle}${brush.density}${brush.ratio}${brush.spikes}${brush.spacing}${brush.size}${brush.color}`;
  }

  drawStamp: StampFn = (
    layer,
    brush,
    position,
    size,
    color,
    alpha,
    blendMode,
    clearCache
  ) => {
    const pixiCtr = PixiController.getInstance();
    const extendedBrush = { ...brush, size, color };
    if (clearCache) {
      this.clearCache(extendedBrush);
    }
    const cached = this.stampCache[this.getCacheName(extendedBrush)];
    const stamp =
      cached ??
      (extendedBrush.type === 'auto'
        ? BrushEngine.drawStamp
        : BrushEngine.drawTextureStamp)(PixiController.app.renderer, {
        ...brush,
        size,
        color,
      });

    if (stamp) {
      const actualBlend =
        blendMode === BLEND_MODES.ERASE ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
      stamp.blendMode = actualBlend;
      stamp.groupBlendMode = actualBlend;
      stamp.position.set(position.x - size, position.y - size);
      stamp.alpha = alpha;
      pixiCtr.renderToTarget(stamp, layer.rt, false);
      this.saveCache(extendedBrush, stamp);
    }
  };

  clearCache(brush: BrushExtended) {
    const stamp = this.stampCache[this.getCacheName(brush)];
    if (stamp) {
      stamp.destroy({
        children: true,
        texture: true,
        textureSource: true,
        context: true,
        style: true,
      });
      delete this.stampCache[this.getCacheName(brush)];
    }
  }

  setBrush(newBrush: Brush) {
    this.brush = newBrush;
  }
}
