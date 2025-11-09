import { BLEND_MODES, Brush, StampFn } from '../utils';
import { BrushEngine } from './brushEngine';

export class BrushController {
  brush: Brush = {
    angle: 0,
    density: 100,
    ratio: 1,
    spikes: 12,
    spacing: 1,
  };

  drawStamp: StampFn = (
    pixiCtr,
    layer,
    position,
    size,
    color,
    alpha,
    blendMode
  ) => {
    // TODO: SPACING
    const stamp = BrushEngine.drawStamp(pixiCtr.app.renderer, {
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
      stamp.destroy({
        children: true,
        texture: true,
        textureSource: true,
        context: true,
        style: true,
      });
    }
  };

  setBrush(newBrush: Brush) {
    this.brush = newBrush;
  }
}
