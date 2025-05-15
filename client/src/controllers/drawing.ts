import {
  FederatedPointerEvent,
  Graphics,
  Point,
  StrokeStyle as StrokeStylePixi,
} from 'pixi.js';
import { checkBlendModes, distance, Layer } from '../utils';
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
  currentStrokeGraphics: Graphics | null = null;
  lastDrawingPosition: Point | null = null;
  accumulatedDrawCommands: DrawCommand[] = [];
  minStabDelta = 5;
  stroke: Graphics | null = null;

  constructor(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController,
    networkCtr: NetworkController
  ) {
    pixiCtr.app.stage
      .on('pointerdown', (e) =>
        this.onPointerDown(e, pixiCtr, layerCtr, historyCtr)
      )
      .on('pointermove', (e) => this.onPointerMove(e, pixiCtr, layerCtr))
      .on('pointerup', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      )
      .on('pointerupoutside', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      );
  }

  execDrawCommand(
    pixiCtr: PixiController,
    layer: Layer,
    commands: DrawCommand[]
  ) {
    let stroke = new Graphics();
    let lastPos: Point;

    commands.forEach((commandBlock) => {
      switch (commandBlock.commandType) {
        case 'initLine': {
          const pos = commandBlock.pos;
          if (!pos) return;

          lastPos = new Point(pos.x, pos.y);
          stroke = this.initLine(
            layer,
            lastPos,
            commandBlock.blendMode,
            commandBlock.strokeStyle
          );

          break;
        }
        case 'line': {
          if (!commandBlock.pos) return;
          lastPos = this.line(
            new Point(commandBlock.pos.x, commandBlock.pos.y),
            lastPos,
            stroke
          );
          break;
        }
        case 'endLine':
          {
            this.endLine(pixiCtr, stroke, layer);
          }
          break;
        default:
          break;
      }
    });
    stroke.destroy();
  }

  initLine(
    layer: Layer,
    pos: Point,
    blendMode?: string,
    strokeStyle?: StrokeStyle
  ) {
    const stroke = new Graphics();
    stroke.strokeStyle = {
      width: 10,
      cap: 'round',
      color: 0x000000,
      ...(strokeStyle as StrokeStylePixi),
    };

    const mode = checkBlendModes(blendMode);
    stroke.blendMode = mode;
    stroke.groupBlendMode = mode;
    stroke.moveTo(pos.x, pos.y);
    stroke.lineTo(pos.x, pos.y - 0.01);
    stroke.stroke();
    layer.container.addChild(stroke);

    return stroke;
  }

  line(pos: Point, lastPos: Point, stroke: Graphics) {
    const mid = {
      x: (pos.x + lastPos.x) * 0.5,
      y: (pos.y + lastPos.y) * 0.5,
    };

    stroke.quadraticCurveTo(lastPos.x, lastPos.y, mid.x, mid.y);
    stroke.stroke();
    lastPos = new Point(pos.x, pos.y);
    return lastPos;
  }

  endLine(pixiCtr: PixiController, stroke: Graphics, layer: Layer) {
    pixiCtr.renderToTarget(stroke, layer.rt, false);
    stroke.destroy();
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

    const command: DrawCommand = {
      commandType: 'initLine',
      pos,
      blendMode: 'normal',
      strokeStyle: { ...this.strokeStyle },
    };

    if (this.isErasing) {
      command.blendMode = 'erase';
    }
    this.stroke = this.initLine(
      activeLayer,
      pos,
      command.blendMode,
      this.strokeStyle
    );

    this.accumulatedDrawCommands.push(command);
    this.lastDrawingPosition = pos;
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
      const x = e.movementX / stageScale;
      const y = e.movementY / stageScale;
      pixiCtr.moveBoardBy(x, y);
      return;
    }
    if (!this.drawing || !this.stroke) return;
    const pos = pixiCtr.offsetPosition(e.clientX, e.clientY);

    if (!this.lastDrawingPosition) {
      this.lastDrawingPosition = pos;
    }

    if (distance(pos, this.lastDrawingPosition) < this.minStabDelta) return;

    const command: DrawCommand = {
      commandType: 'line',
      pos,
      blendMode: undefined,
      strokeStyle: undefined,
    };

    this.accumulatedDrawCommands.push(command);
    this.lastDrawingPosition = this.line(
      pos,
      this.lastDrawingPosition,
      this.stroke
    );
  }

  onPointerUp(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController,
    networkCtr: NetworkController
  ) {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;

    this.drawing = false;
    this.pan = false;

    if (this.stroke) {
      this.endLine(pixiCtr, this.stroke, activeLayer);
      historyCtr.saveState(pixiCtr, activeLayer);

      const command: DrawCommand = {
        commandType: 'endLine',
        blendMode: undefined,
        strokeStyle: undefined,
        pos: undefined,
      };

      this.accumulatedDrawCommands.push(command);
      pixiCtr.extractBase64(activeLayer.rt).then((data) => {
        networkCtr.emitSaveLayerRequest(activeLayer.id, data, false);
      });

      networkCtr.emitDrawCommands(activeLayer.id, this.accumulatedDrawCommands);
      this.accumulatedDrawCommands = [];

      this.stroke = null;
    }
  }

  setDrawingTool(tool: Tools) {
    switch (tool) {
      case Tools.BRUSH: {
        this.isErasing = false;
        break;
      }
      case Tools.ERASER: {
        this.isErasing = true;
        break;
      }
    }
  }

  toggleEraser() {
    this.isErasing = !this.isErasing;
    return this.isErasing;
  }

  setCurrentColor(color: string) {
    this.strokeStyle.color = Number(color.replace('#', '0x'));
  }
}
