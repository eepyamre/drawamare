import { FederatedPointerEvent, Point } from 'pixi.js';

import {
  IBrushController,
  IDrawingController,
  IHistoryController,
  ILayerController,
  INetworkController,
  IPixiController,
  Layer,
} from '../interfaces';
import { DrawCommand, StrokeStyle } from '../module_bindings';
import { BLEND_MODES, Brush } from '../utils';
import { BrushController } from './brush';
import { PixiController } from './pixi';
import { BrushSettingsUI, PressureSettings, Tools } from './ui';

export class DrawingController implements IDrawingController {
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
  // FIXME: REFACTOR
  constructor(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    historyCtr: IHistoryController,
    networkCtr: INetworkController,
    brushSettingsUI: BrushSettingsUI,
    brushCtr: IBrushController
  ) {
    const stage = pixiCtr.app.stage;
    this.strokeStyle.width = brushSettingsUI.getBrushSize();
    this.strokeStyle.alpha = brushSettingsUI.getBrushOpacity();
    this.pressureSettings = brushSettingsUI.getPressureSettings();

    stage
      .on('pointerdown', (e: FederatedPointerEvent) =>
        this.onPointerDown(e, pixiCtr, layerCtr, historyCtr, brushCtr)
      )
      .on('pointermove', (e: FederatedPointerEvent) =>
        this.onPointerMove(e, pixiCtr, layerCtr, brushCtr)
      )
      .on('pointerup', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr, brushCtr)
      )
      .on('pointerupoutside', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr, brushCtr)
      );
  }

  // TODO: REDO
  execDrawCommand(
    pixiCtr: PixiController,
    brushCtr: BrushController,
    layer: Layer,
    commands: DrawCommand[]
  ) {
    let lastPos: Point | null = null;
    let lastColor = 0x000000;

    for (const cmd of commands) {
      if (cmd.commandType === 'initLine' && cmd.pos && cmd.strokeStyle) {
        lastPos = new Point(cmd.pos.x, cmd.pos.y);
        lastColor = cmd.strokeStyle.color!;

        brushCtr.drawStamp(
          pixiCtr,
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
            pixiCtr,
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
          pixiCtr,
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

  onPointerDown(
    e: FederatedPointerEvent,
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    historyCtr: IHistoryController,
    brushCtr: IBrushController
  ) {
    const layer = layerCtr.getActiveLayer();
    if (!layer) return;
    if (e.button === 1 || this.pan) {
      this.pan = true;
      return;
    }
    if (e.button !== 0) return;

    this.drawing = true;
    historyCtr.clearRedo();
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
      pixiCtr,
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

  onPointerMove(
    e: FederatedPointerEvent,
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    brushCtr: IBrushController
  ) {
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
        pixiCtr,
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
      pixiCtr,
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

  onPointerUp(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    historyCtr: IHistoryController,
    networkCtr: INetworkController,
    brushCtr: IBrushController
  ) {
    if (!this.drawing) {
      this.pan = false;
      return;
    }
    this.drawing = false;
    this.pan = false;
    this.lastDrawingPosition = null;

    const layer = layerCtr.getActiveLayer();
    if (!layer) return;
    historyCtr.saveState(pixiCtr, layer);

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
      networkCtr.emitSaveLayerRequest(layer.id, data, false);
    });
    networkCtr.emitDrawCommands(layer.id, this.accumulatedDrawCommands);
    this.accumulatedDrawCommands = [];
  }

  setDrawingTool(tool: Tools) {
    this.isErasing = tool === Tools.ERASER;
  }
  toggleEraser() {
    return (this.isErasing = !this.isErasing);
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
