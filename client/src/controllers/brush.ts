import { BLEND_MODES, Brushes, StampFn } from '../utils';
import { BrushEngine } from './brushEngine';

export class BrushController {
  private brushEngine: BrushEngine;

  constructor(brushEngine: BrushEngine) {
    this.brushEngine = brushEngine;
  }

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
    const stamp = this.brushEngine.drawStamp(pixiCtr.app.renderer, size, color);

    if (stamp) {
      const actualBlend =
        blendMode === BLEND_MODES.ERASE ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
      stamp.blendMode = actualBlend;
      stamp.groupBlendMode = actualBlend;
      stamp.position.set(position.x - size, position.y - size);
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

  setBrush(newBrush: Brushes) {
    alert('TODO');
    // this.brush = newBrush;
  }
}
