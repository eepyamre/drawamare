import { FederatedPointerEvent, Graphics, Point } from 'pixi.js';
import { checkBlendModes, Layer } from '../utils';
import { DrawCommand, StrokeStyle } from '../module_bindings';
import { PixiController } from './pixi';
import { Tools } from './ui';
import { LayerController } from './layer';
import { NetworkController } from './network';
import { HistoryController } from './history';

export class DrawingController {
  strokeStyle: StrokeStyle = {
    width: 10,
    cap: 'round',
    color: 0x000000,
  };
  isErasing: boolean = false;
  drawing: boolean = false;
  pan: boolean = false;

  lastDrawingPosition: Point | null = null;
  lastWidth: number = 0;

  accumulatedDrawCommands: DrawCommand[] = [];

  constructor(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController,
    networkCtr: NetworkController
  ) {
    pixiCtr.app.stage
      .on('pointerdown', (e: any) =>
        this.onPointerDown(e, pixiCtr, layerCtr, historyCtr)
      )
      .on('pointermove', (e: any) => this.onPointerMove(e, pixiCtr, layerCtr))
      .on('pointerup', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      )
      .on('pointerupoutside', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      );
  }

  drawStamp(
    pixiCtr: PixiController,
    layer: Layer,
    position: Point,
    width: number,
    color: number,
    blendMode: string
  ) {
    const stamp = new Graphics();
    const mode = checkBlendModes(blendMode);
    stamp.blendMode = mode;
    stamp.groupBlendMode = mode;

    stamp.circle(position.x, position.y, width / 2);
    stamp.fill(color);

    pixiCtr.renderToTarget(stamp, layer.rt, false);
    stamp.destroy();
  }

  execDrawCommand(
    pixiCtr: PixiController,
    layer: Layer,
    commands: DrawCommand[]
  ) {
    let lastPos: Point | null = null;
    let lastColor: number = 0;

    commands.forEach((commandBlock) => {
      switch (commandBlock.commandType) {
        case 'initLine': {
          if (!commandBlock.pos || !commandBlock.strokeStyle) return;
          lastPos = new Point(commandBlock.pos.x, commandBlock.pos.y);
          lastColor = commandBlock.strokeStyle.color!;

          this.drawStamp(
            pixiCtr,
            layer,
            lastPos,
            commandBlock.strokeStyle.width!,
            lastColor,
            commandBlock.blendMode!
          );
          break;
        }
        case 'line': {
          if (!commandBlock.pos || !lastPos || !commandBlock.blendMode) return;
          const startPos = lastPos;
          const endPos = new Point(commandBlock.pos.x, commandBlock.pos.y);

          const startWidth = commandBlock.startWidth!;
          const endWidth = commandBlock.endWidth!;

          const distance = Math.hypot(
            endPos.x - startPos.x,
            endPos.y - startPos.y
          );
          const angle = Math.atan2(
            endPos.y - startPos.y,
            endPos.x - startPos.x
          );

          const stepSize = Math.min(startWidth, endWidth) / 4 || 1;

          for (let i = 0; i < distance; i += stepSize) {
            const t = i / distance;
            const currentPos = new Point(
              startPos.x + Math.cos(angle) * i,
              startPos.y + Math.sin(angle) * i
            );
            // Interpolate width for a smooth transition.
            const currentWidth = startWidth + (endWidth - startWidth) * t;
            this.drawStamp(
              pixiCtr,
              layer,
              currentPos,
              currentWidth,
              lastColor,
              commandBlock.blendMode
            );
          }
          // Ensure the final point is stamped.
          this.drawStamp(
            pixiCtr,
            layer,
            endPos,
            endWidth,
            lastColor,
            commandBlock.blendMode
          );

          lastPos = endPos;
          break;
        }
        case 'endLine': {
          lastPos = null;
          break;
        }
      }
    });
  }

  onPointerDown(
    e: FederatedPointerEvent,
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController
  ) {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;

    const pos = pixiCtr.offsetPosition(e.clientX, e.clientY);

    if (e.button === 1) {
      this.pan = true;
      return;
    }
    if (e.button !== 0) return;

    this.drawing = true;
    historyCtr.clearRedo();
    this.lastDrawingPosition = pos;

    const currentWidth = this.strokeStyle.width * e.pressure;
    this.lastWidth = currentWidth;

    const currentStyle: StrokeStyle = {
      ...this.strokeStyle,
      width: currentWidth,
    };
    const blendMode = this.isErasing ? 'erase' : 'normal';

    this.drawStamp(
      pixiCtr,
      activeLayer,
      pos,
      currentWidth,
      this.strokeStyle.color,
      blendMode
    );

    const command: DrawCommand = {
      commandType: 'initLine',
      pos,
      blendMode,
      strokeStyle: currentStyle,
      endWidth: undefined,
      startWidth: undefined,
    };
    this.accumulatedDrawCommands.push(command);
  }

  onPointerMove(
    e: FederatedPointerEvent,
    pixiCtr: PixiController,
    layerCtr: LayerController
  ) {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;
    const stageScale = pixiCtr.getScale();
    if (this.pan) {
      pixiCtr.moveBoardBy(e.movementX / stageScale, e.movementY / stageScale);
      return;
    }
    if (!this.drawing || !this.lastDrawingPosition) return;

    const startPos = this.lastDrawingPosition;
    const endPos = pixiCtr.offsetPosition(e.clientX, e.clientY);

    const distance = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
    if (distance === 0) return;

    const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);

    const startWidth = this.lastWidth;
    const endWidth = this.strokeStyle.width * e.pressure;

    const blendMode = this.isErasing ? 'erase' : 'normal';

    const stepSize = Math.min(startWidth, endWidth) / 4 || 1;

    for (let i = 0; i < distance; i += stepSize) {
      const t = i / distance; // Interpolation factor (0 to 1)

      const currentPos = new Point(
        startPos.x + Math.cos(angle) * i,
        startPos.y + Math.sin(angle) * i
      );
      const currentWidth = startWidth + (endWidth - startWidth) * t;

      this.drawStamp(
        pixiCtr,
        activeLayer,
        currentPos,
        currentWidth,
        this.strokeStyle.color,
        blendMode
      );
    }
    this.drawStamp(
      pixiCtr,
      activeLayer,
      endPos,
      endWidth,
      this.strokeStyle.color,
      blendMode
    );

    const command: DrawCommand = {
      commandType: 'line',
      pos: endPos,
      blendMode,
      startWidth,
      endWidth,
      strokeStyle: undefined,
    };
    this.accumulatedDrawCommands.push(command);

    this.lastDrawingPosition = endPos;
    this.lastWidth = endWidth;
  }

  onPointerUp(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController,
    networkCtr: NetworkController
  ) {
    if (!this.drawing) {
      this.pan = false;
      return;
    }
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;

    this.drawing = false;
    this.pan = false;
    this.lastDrawingPosition = null;

    historyCtr.saveState(pixiCtr, activeLayer);

    const command: DrawCommand = {
      commandType: 'endLine',
      blendMode: undefined,
      strokeStyle: undefined,
      pos: undefined,
      endWidth: undefined,
      startWidth: undefined,
    };
    this.accumulatedDrawCommands.push(command);

    pixiCtr.extractBase64(activeLayer.rt).then((data) => {
      networkCtr.emitSaveLayerRequest(activeLayer.id, data, false);
    });

    networkCtr.emitDrawCommands(activeLayer.id, this.accumulatedDrawCommands);
    this.accumulatedDrawCommands = [];
  }

  setDrawingTool(tool: Tools) {
    this.isErasing = tool === Tools.ERASER;
  }

  toggleEraser() {
    this.isErasing = !this.isErasing;
    return this.isErasing;
  }

  setCurrentColor(color: string) {
    this.strokeStyle.color = Number(color.replace('#', '0x'));
  }
}
