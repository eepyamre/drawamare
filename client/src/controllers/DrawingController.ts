import { FederatedPointerEvent, Graphics, Point } from 'pixi.js';

import { AppEvents, EventBus } from '../events';
import { IDrawingController, Layer } from '../interfaces';
import { DrawCommand, StrokeStyle } from '../module_bindings/types';
import { BrushSettingsUI, PressureSettings } from '../ui';
import {
  BLEND_MODES,
  Tools,
  brushToSpacetime,
  spacetimeToBrush,
} from '../utils';
import { BrushController } from './BrushController';
import { LayerController } from './LayerController';
import { PixiController } from './PixiController';

export class DrawingController implements IDrawingController {
  private static instance: IDrawingController;

  strokeStyle: StrokeStyle = {
    width: 10,
    cap: 'round',
    color: 0x000000,
    alpha: 1,
  };
  currentTool: Tools = Tools.BRUSH;
  isErasing = false;
  drawing = false;
  pan = false;

  lastDrawingPosition: Point | null = null;
  lastMousePosition: Point | null = null;
  lastWidth = 0;
  lastAlpha = 1;
  accumulatedDrawCommands: DrawCommand[] = [];
  pressureSettings: PressureSettings = {
    opacity: false,
    size: false,
  };

  shapeStartPos: Point | null = null;
  stabilizerBuffer: Point[] = [];
  stabilizerMaxSize = 6;

  constructor() {
    const stage = PixiController.app.stage;
    this.strokeStyle.width = BrushSettingsUI.getInstance().getBrushSize();
    this.strokeStyle.alpha = BrushSettingsUI.getInstance().getBrushOpacity();
    this.pressureSettings = BrushSettingsUI.getInstance().getPressureSettings();
    this.stabilizerMaxSize = BrushSettingsUI.getInstance().getStabilization();

    stage
      .on('pointerdown', this.onPointerDown.bind(this))
      .on('pointermove', this.onPointerMove.bind(this))
      .on('pointerup', this.onPointerUp.bind(this))
      .on('pointerupoutside', this.onPointerUp.bind(this));

    this.initBusListeners();
  }

  static getInstance(): IDrawingController {
    if (!this.instance) {
      this.instance = new DrawingController();
    }

    return this.instance;
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.DRAWING_SET_TOOL, this.setDrawingTool.bind(this));
    bus.on(AppEvents.BRUSH_COLOR_CHANGE, this.setCurrentColor.bind(this));
    bus.on(AppEvents.CANVAS_SET_PAN_MODE, this.setPanMode.bind(this));
    bus.on(AppEvents.BRUSH_SIZE_CHANGE, this.setSize.bind(this));
    bus.on(AppEvents.BRUSH_OPACITY_CHANGE, this.setOpacity.bind(this));
    bus.on(
      AppEvents.BRUSH_PRESSUTE_TOGGLE,
      this.setPressureSettings.bind(this)
    );
    bus.on(
      AppEvents.BRUSH_STABILIZATION_CHANGE,
      this.setStabilization.bind(this)
    );
  }

  execDrawCommand(layer: Layer, commands: DrawCommand[]) {
    const brushCtr = BrushController.getInstance();
    let lastPos: Point | null = null;
    let lastColor = 0x000000;

    for (const cmd of commands) {
      if (cmd.commandType === 'initLine' && cmd.pos && cmd.strokeStyle) {
        lastPos = new Point(cmd.pos.x, cmd.pos.y);
        lastColor = cmd.strokeStyle.color!;

        brushCtr.drawStamp(
          layer,
          spacetimeToBrush(cmd.brush),
          lastPos,
          cmd.strokeStyle.width!,
          lastColor,
          cmd.strokeStyle.alpha!,
          cmd.blendMode as BLEND_MODES,
          true
        );
      } else if (
        cmd.commandType === 'line' &&
        lastPos &&
        cmd.pos &&
        cmd.strokeStyle
      ) {
        const start = lastPos;
        const end = new Point(cmd.pos.x, cmd.pos.y);
        const sw = cmd.startWidth!;
        const ew = cmd.endWidth!;
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        const ang = Math.atan2(end.y - start.y, end.x - start.x);
        const step = (Math.min(sw, ew) / 4 || 1) * cmd.brush.spacing;

        for (let i = 0; i <= dist; i += step) {
          const t = i / dist;
          const x = start.x + Math.cos(ang) * i;
          const y = start.y + Math.sin(ang) * i;
          const w = sw + (ew - sw) * t;
          brushCtr.drawStamp(
            layer,
            spacetimeToBrush(cmd.brush),
            new Point(x, y),
            w,
            lastColor,
            cmd.strokeStyle.alpha,
            cmd.blendMode as BLEND_MODES,
            false
          );
        }
        brushCtr.drawStamp(
          layer,
          spacetimeToBrush(cmd.brush),
          end,
          ew,
          lastColor,
          cmd.strokeStyle.alpha,
          cmd.blendMode as BLEND_MODES,
          false
        );
        lastPos = end;
      } else if (cmd.commandType === 'endLine') {
        lastPos = null;
      }
    }
  }

  onPointerDown(e: FederatedPointerEvent) {
    const layerCtr = LayerController.getInstance();
    const pixiCtr = PixiController.getInstance();
    const brushCtr = BrushController.getInstance();

    const layer = layerCtr.getActiveLayer();

    if (!layer) {
      EventBus.getInstance().emit(AppEvents.NETWORK_CREATE_LAYER, null);
      return;
    }
    if (e.button === 1 || this.pan) {
      this.pan = true;
      return;
    }
    if (e.button !== 0) return;

    const pos = pixiCtr.offsetPosition(e.clientX, e.clientY);
    this.lastMousePosition = pos;

    if (this.currentTool === Tools.EYEDROPPER) {
      this.pickColor(pos);
      return;
    }

    this.drawing = true;
    EventBus.getInstance().emit(AppEvents.HISTORY_CLEAR_REDO, null);

    if (
      this.currentTool === Tools.LINE ||
      this.currentTool === Tools.RECTANGLE ||
      this.currentTool === Tools.CIRCLE
    ) {
      this.shapeStartPos = pos;
      this.stabilizerBuffer = [];
      return;
    }

    this.lastDrawingPosition = pos;
    this.stabilizerBuffer = this.stabilizerMaxSize > 0 ? [pos] : [];

    const pressure = e.pointerType !== 'mouse' ? e.pressure : 1;
    let width = this.pressureSettings.size
      ? this.strokeStyle.width * pressure
      : this.strokeStyle.width;

    if (width < 0) width = 1;

    const alpha = this.pressureSettings.opacity
      ? this.strokeStyle.alpha * pressure
      : this.strokeStyle.alpha;

    this.lastWidth = width;
    this.lastAlpha = alpha;

    const style: StrokeStyle = { ...this.strokeStyle, width, alpha };
    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.NORMAL;

    brushCtr.drawStamp(
      layer,
      brushCtr.brush,
      pos,
      width,
      style.color,
      alpha,
      blend,
      true
    );

    this.accumulatedDrawCommands.push({
      commandType: 'initLine',
      pos,
      blendMode: blend,
      strokeStyle: style,
      startWidth: undefined,
      endWidth: undefined,
      brush: brushToSpacetime(brushCtr.brush),
    });
  }

  onPointerMove(e: FederatedPointerEvent) {
    const layerCtr = LayerController.getInstance();
    const pixiCtr = PixiController.getInstance();
    const brushCtr = BrushController.getInstance();

    const offsetPosition = pixiCtr.offsetPosition(e.clientX, e.clientY);
    pixiCtr.setMousePosition(offsetPosition);
    this.lastMousePosition = offsetPosition;

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    if (e.buttons !== 0 && this.pan) {
      pixiCtr.moveBoardBy(
        e.movementX / pixiCtr.getScale(),
        e.movementY / pixiCtr.getScale()
      );
      return;
    }
    if (!this.drawing) return;

    // Shape preview
    if (
      this.shapeStartPos &&
      (this.currentTool === Tools.LINE ||
        this.currentTool === Tools.RECTANGLE ||
        this.currentTool === Tools.CIRCLE)
    ) {
      this.drawShapePreview(this.shapeStartPos, offsetPosition);
      return;
    }

    if (!this.lastDrawingPosition) return;

    // Brush stabilization
    this.stabilizerBuffer.push(offsetPosition);
    if (this.stabilizerBuffer.length > this.stabilizerMaxSize) {
      this.stabilizerBuffer.shift();
    }

    const smoothedPos = this.getStabilizedPoint();
    if (!smoothedPos) return;

    const start = this.lastDrawingPosition;
    const end = smoothedPos;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist === 0) return;

    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const sw = this.lastWidth;
    const sa = this.lastAlpha;
    const pressure = e.pointerType !== 'mouse' ? e.pressure : 1;
    let ew = this.pressureSettings.size
      ? this.strokeStyle.width * pressure
      : this.strokeStyle.width;

    if (ew < 0) ew = 1;

    const ea = this.pressureSettings.opacity
      ? this.strokeStyle.alpha * pressure
      : this.strokeStyle.alpha;

    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.NORMAL;
    const step = (Math.min(sw, ew) / 4 || 1) * brushCtr.brush.spacing;

    pixiCtr.setMouseSize(ew);

    for (let i = 0; i <= dist; i += step) {
      const t = i / dist;
      const x = start.x + Math.cos(ang) * i;
      const y = start.y + Math.sin(ang) * i;
      const w = sw + (ew - sw) * t;
      const a = sa + (ea - sa) * t;
      brushCtr.drawStamp(
        layer,
        brushCtr.brush,
        new Point(x, y),
        w,
        this.strokeStyle.color,
        a,
        blend,
        false
      );
    }
    brushCtr.drawStamp(
      layer,
      brushCtr.brush,
      end,
      ew,
      this.strokeStyle.color,
      ea,
      blend,
      false
    );

    const command: DrawCommand = {
      commandType: 'line',
      pos: end,
      blendMode: blend,
      startWidth: sw,
      endWidth: ew,
      strokeStyle: {
        ...this.strokeStyle,
        alpha: ea,
      },
      brush: brushToSpacetime(brushCtr.brush),
    };

    this.accumulatedDrawCommands.push(command);

    this.lastDrawingPosition = end;
    this.lastWidth = ew;
    this.lastAlpha = ea;
  }

  onPointerUp() {
    if (!this.drawing) {
      this.pan = false;
      return;
    }
    const layerCtr = LayerController.getInstance();
    const pixiCtr = PixiController.getInstance();
    const brushCtr = BrushController.getInstance();

    this.drawing = false;
    this.pan = false;
    this.lastDrawingPosition = null;
    this.stabilizerBuffer = [];

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    // Shape tool finalize
    if (
      this.shapeStartPos &&
      (this.currentTool === Tools.LINE ||
        this.currentTool === Tools.RECTANGLE ||
        this.currentTool === Tools.CIRCLE)
    ) {
      this.finalizeShape(layer, this.lastMousePosition || this.shapeStartPos);
      this.shapeStartPos = null;
      PixiController.shapePreview.clear();
      return;
    }

    EventBus.getInstance().emit(AppEvents.HISTORY_SAVE_STATE, layer);

    this.accumulatedDrawCommands.push({
      commandType: 'endLine',
      blendMode: undefined,
      strokeStyle: undefined,
      pos: undefined,
      startWidth: undefined,
      endWidth: undefined,
      brush: brushToSpacetime(brushCtr.brush),
    });

    pixiCtr.extractBase64(layer.rt).then((data) => {
      EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
        layerId: layer.id,
        base64: data,
        forceUpdate: false,
      });
    });
    EventBus.getInstance().emit(AppEvents.NETWORK_DRAW_COMMANDS, {
      layerId: layer.id,
      commands: this.accumulatedDrawCommands,
    });
    this.accumulatedDrawCommands = [];
  }

  private getStabilizedPoint(): Point | null {
    if (this.stabilizerBuffer.length === 0) return null;
    let x = 0;
    let y = 0;
    for (const p of this.stabilizerBuffer) {
      x += p.x;
      y += p.y;
    }
    return new Point(
      x / this.stabilizerBuffer.length,
      y / this.stabilizerBuffer.length
    );
  }

  private drawShapePreview(start: Point, current: Point) {
    const g = PixiController.shapePreview;
    g.clear();
    if (this.currentTool === Tools.LINE) {
      g.moveTo(start.x, start.y);
      g.lineTo(current.x, current.y);
    } else if (this.currentTool === Tools.RECTANGLE) {
      const x = Math.min(start.x, current.x);
      const y = Math.min(start.y, current.y);
      const w = Math.abs(current.x - start.x);
      const h = Math.abs(current.y - start.y);
      g.rect(x, y, w, h);
    } else if (this.currentTool === Tools.CIRCLE) {
      const r = Math.hypot(current.x - start.x, current.y - start.y);
      g.circle(start.x, start.y, r);
    }
    g.stroke({
      width: this.strokeStyle.width,
      color: this.strokeStyle.color,
      alpha: this.strokeStyle.alpha,
    });
    PixiController.board.addChild(g);
  }

  private finalizeShape(layer: Layer, endPos: Point) {
    const pixiCtr = PixiController.getInstance();
    const g = new Graphics();

    const color = this.strokeStyle.color;
    const alpha = this.strokeStyle.alpha;
    const width = this.strokeStyle.width;

    const start = this.shapeStartPos!;

    if (this.currentTool === Tools.LINE) {
      g.moveTo(start.x, start.y);
      g.lineTo(endPos.x, endPos.y);
    } else if (this.currentTool === Tools.RECTANGLE) {
      const x = Math.min(start.x, endPos.x);
      const y = Math.min(start.y, endPos.y);
      const w = Math.abs(endPos.x - start.x);
      const h = Math.abs(endPos.y - start.y);
      g.rect(x, y, w, h);
    } else if (this.currentTool === Tools.CIRCLE) {
      const r = Math.hypot(endPos.x - start.x, endPos.y - start.y);
      g.circle(start.x, start.y, r);
    }
    g.stroke({ width, color, alpha });

    pixiCtr.renderToTarget(g, layer.rt, false);
    g.destroy();

    EventBus.getInstance().emit(AppEvents.HISTORY_SAVE_STATE, layer);
    void pixiCtr.extractBase64(layer.rt).then((data) => {
      EventBus.getInstance().emit(AppEvents.NETWORK_SAVE_LAYER, {
        layerId: layer.id,
        base64: data,
        forceUpdate: true,
      });
    });
  }

  private async pickColor(pos: Point) {
    const hex = await PixiController.getInstance().getPixelColor(pos);
    if (hex !== null) {
      EventBus.getInstance().emit(AppEvents.BRUSH_COLOR_CHANGE, hex);
    }
  }

  setDrawingTool(tool: Tools) {
    this.isErasing = tool === Tools.ERASER;
    this.currentTool = tool;
  }
  setCurrentColor(hex: string) {
    this.strokeStyle.color = Number(hex.replace('#', '0x'));
  }
  setSize(size: number) {
    this.strokeStyle.width = size;
  }
  setOpacity(opacity: number) {
    this.strokeStyle.alpha = opacity;
  }
  setPressureSettings(settings: PressureSettings) {
    this.pressureSettings = settings;
  }
  setStabilization(value: number) {
    this.stabilizerMaxSize = value;
  }
  setPanMode(boolean: boolean) {
    this.pan = boolean;
  }
}
