import { BLEND_MODES, Brush, BrushExtended, StampFn } from '../utils';
import { BrushEngine } from './brushEngine';
import { Sprite } from 'pixi.js';

export class BrushController {
  brush: Brush = {
    angle: 0,
    density: 100,
    ratio: 1,
    spikes: 12,
    spacing: 1,
    shape: 'circle',
  };

  // string of <angle><density><ratio><spikes><spacing><size><color>
  stampCache: Record<string, Sprite> = {};

  saveCache(brush: BrushExtended, sprite: Sprite) {
    this.stampCache[this.getCacheName(brush)] = sprite;
  }

  getCacheName(brush: BrushExtended) {
    return `${brush.angle}${brush.density}${brush.ratio}${brush.spikes}${brush.spacing}${brush.size}${brush.color}`;
  }

  drawStamp: StampFn = (
    pixiCtr,
    layer,
    position,
    size,
    color,
    alpha,
    blendMode,
    clearCache
  ) => {
    const extendedBrush = { ...this.brush, size, color };
    if (clearCache) {
      this.clearCache(extendedBrush);
    }
    const cached = this.stampCache[this.getCacheName(extendedBrush)];
    const stamp =
      cached ??
      BrushEngine.drawStamp(pixiCtr.app.renderer, {
        ...this.brush,
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
