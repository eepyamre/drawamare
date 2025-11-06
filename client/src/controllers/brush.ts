import { BLEND_MODES, Brushes, Layer, StampFn } from '../utils';
import { PixiController } from './pixi';
import { Point, Graphics } from 'pixi.js';

const stamps: Record<Brushes, StampFn> = {
  [Brushes.ROUND]: (
    pixiCtr: PixiController,
    layer: Layer,
    position: Point,
    diameter: number,
    color: number,
    alpha: number,
    blendMode: BLEND_MODES
  ) => {
    const stamp = new Graphics();
    const actualBlend =
      blendMode === BLEND_MODES.ERASE ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
    stamp.blendMode = actualBlend;
    stamp.groupBlendMode = actualBlend;
    stamp.beginFill(color, alpha);
    stamp.drawCircle(position.x, position.y, diameter / 2);
    stamp.endFill();

    pixiCtr.renderToTarget(stamp, layer.rt, false);
    stamp.destroy();
  },
  [Brushes.SQUARE]: (
    pixiCtr: PixiController,
    layer: Layer,
    position: Point,
    diameter: number,
    color: number,
    alpha: number,
    blendMode: BLEND_MODES
  ) => {
    const stamp = new Graphics();
    const actualBlend =
      blendMode === BLEND_MODES.ERASE ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
    stamp.blendMode = actualBlend;
    stamp.groupBlendMode = actualBlend;
    stamp.beginFill(color, alpha);
    stamp.drawRect(
      position.x - diameter / 2,
      position.y - diameter / 2,
      diameter,
      diameter
    );
    stamp.endFill();

    pixiCtr.renderToTarget(stamp, layer.rt, false);
    stamp.destroy();
  },
  [Brushes.SPRAY]: () => {
    alert('NOT YET');
  },
};

export class BrushController {
  private brush: Brushes = Brushes.ROUND;

  drawStamp: StampFn = (...args) => {
    stamps[this.brush](...args);
  };

  setBrush(newBrush: Brushes) {
    this.brush = newBrush;
  }
}
