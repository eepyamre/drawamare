import { FederatedPointerEvent, Point } from 'pixi.js';

import { AppEvents, EventBus } from '../events';
import { IDrawingController, Layer } from '../interfaces';
import { DrawCommand, StrokeStyle } from '../module_bindings';
import { BrushSettingsUI, PressureSettings } from '../ui';
import { BLEND_MODES, Brush, Tools } from '../utils';
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
  isErasing = false;
  drawing = false;
  pan = false;

  lastDrawingPosition: Point | null = null;
  lastWidth = 0;
  lastAlpha = 1;
  accumulatedDrawCommands: DrawCommand[] = [];
  pressureSettings: PressureSettings = {
    opacity: false,
    size: false,
  };

  constructor() {
    const stage = PixiController.app.stage;
    this.strokeStyle.width = BrushSettingsUI.getInstance().getBrushSize();
    this.strokeStyle.alpha = BrushSettingsUI.getInstance().getBrushOpacity();
    this.pressureSettings = BrushSettingsUI.getInstance().getPressureSettings();

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
          cmd.brush as Brush,
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
            cmd.brush as Brush,
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
          cmd.brush as Brush,
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

    this.drawing = true;
    EventBus.getInstance().emit(AppEvents.HISTORY_CLEAR_REDO, null);
    const pos = pixiCtr.offsetPosition(e.clientX, e.clientY);
    this.lastDrawingPosition = pos;

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
    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.MAX;

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
      brush: brushCtr.brush,
    });
  }

  onPointerMove(e: FederatedPointerEvent) {
    const layerCtr = LayerController.getInstance();
    const pixiCtr = PixiController.getInstance();
    const brushCtr = BrushController.getInstance();

    const offsetPosition = pixiCtr.offsetPosition(e.clientX, e.clientY);
    pixiCtr.setMousePosition(offsetPosition);

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    if (e.buttons !== 0 && this.pan) {
      pixiCtr.moveBoardBy(
        e.movementX / pixiCtr.getScale(),
        e.movementY / pixiCtr.getScale()
      );
      return;
    }
    if (!this.drawing || !this.lastDrawingPosition) return;

    const start = this.lastDrawingPosition;
    const end = offsetPosition;
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

    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
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
      brush: brushCtr.brush,
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

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;

    EventBus.getInstance().emit(AppEvents.HISTORY_SAVE_STATE, layer);

    this.accumulatedDrawCommands.push({
      commandType: 'endLine',
      blendMode: undefined,
      strokeStyle: undefined,
      pos: undefined,
      startWidth: undefined,
      endWidth: undefined,
      brush: brushCtr.brush,
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

  setDrawingTool(tool: Tools) {
    this.isErasing = tool === Tools.ERASER;
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
  setPanMode(boolean: boolean) {
    this.pan = boolean;
  }
}
