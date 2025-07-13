import { FederatedPointerEvent, Graphics, Point } from 'pixi.js';
import { Layer, BLEND_MODES } from '../utils';
import { DrawCommand, StrokeStyle } from '../module_bindings';
import { PixiController } from './pixi';
import { BrushSettingsUI, PressureSettings, Tools } from './ui';
import { LayerController } from './layer';
import { NetworkController } from './network';
import { HistoryController } from './history';

export class DrawingController {
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
  accumulatedDrawCommands: DrawCommand[] = [];
  pressureSettings: PressureSettings = {
    opacity: false,
    size: false,
  };

  constructor(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController,
    networkCtr: NetworkController,
    brushSettingsUI: BrushSettingsUI
  ) {
    const stage = pixiCtr.app.stage;
    this.strokeStyle.width = brushSettingsUI.getBrushSize();
    this.strokeStyle.alpha = brushSettingsUI.getBrushOpacity();
    this.pressureSettings = brushSettingsUI.getPressureSettings();

    stage
      .on('pointerdown', (e: FederatedPointerEvent) =>
        this.onPointerDown(e, pixiCtr, layerCtr, historyCtr)
      )
      .on('pointermove', (e: FederatedPointerEvent) =>
        this.onPointerMove(e, pixiCtr, layerCtr)
      )
      .on('pointerup', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      )
      .on('pointerupoutside', () =>
        this.onPointerUp(pixiCtr, layerCtr, historyCtr, networkCtr)
      );
  }

  /** Draw a single circle “stamp”, using ERASE if erasing, otherwise MAX for no double‑alpha */
  private drawStamp(
    pixiCtr: PixiController,
    layer: Layer,
    position: Point,
    diameter: number,
    color: number,
    alpha: number,
    blendMode: BLEND_MODES
  ) {
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
  }

  execDrawCommand(
    pixiCtr: PixiController,
    layer: Layer,
    commands: DrawCommand[]
  ) {
    let lastPos: Point | null = null;
    let lastColor = 0x000000;

    for (const cmd of commands) {
      if (cmd.commandType === 'initLine' && cmd.pos && cmd.strokeStyle) {
        lastPos = new Point(cmd.pos.x, cmd.pos.y);
        lastColor = cmd.strokeStyle.color!;

        this.drawStamp(
          pixiCtr,
          layer,
          lastPos,
          cmd.strokeStyle.width!,
          lastColor,
          cmd.strokeStyle.alpha!,
          cmd.blendMode as BLEND_MODES
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
        const step = Math.min(sw, ew) / 4 || 1;

        for (let i = 0; i <= dist; i += step) {
          const t = i / dist;
          const x = start.x + Math.cos(ang) * i;
          const y = start.y + Math.sin(ang) * i;
          const w = sw + (ew - sw) * t;
          this.drawStamp(
            pixiCtr,
            layer,
            new Point(x, y),
            w,
            lastColor,
            cmd.strokeStyle.alpha,
            cmd.blendMode as BLEND_MODES
          );
        }
        this.drawStamp(
          pixiCtr,
          layer,
          end,
          ew,
          lastColor,
          cmd.strokeStyle.alpha,
          cmd.blendMode as BLEND_MODES
        );
        lastPos = end;
      } else if (cmd.commandType === 'endLine') {
        lastPos = null;
      }
    }
  }

  onPointerDown(
    e: FederatedPointerEvent,
    pixiCtr: PixiController,
    layerCtr: LayerController,
    historyCtr: HistoryController
  ) {
    const layer = layerCtr.getActiveLayer();
    if (!layer) return;
    if (e.button === 1) {
      this.pan = true;
      return;
    }
    if (e.button !== 0) return;

    this.drawing = true;
    historyCtr.clearRedo();
    const pos = pixiCtr.offsetPosition(e.clientX, e.clientY);
    this.lastDrawingPosition = pos;

    const pressure = e.pointerType !== 'mouse' ? e.pressure : 1;
    const width = this.pressureSettings.size
      ? this.strokeStyle.width * pressure
      : this.strokeStyle.width;
    const alpha = this.pressureSettings.opacity
      ? this.strokeStyle.alpha * pressure
      : this.strokeStyle.alpha;

    this.lastWidth = width;

    const style: StrokeStyle = { ...this.strokeStyle, width, alpha };
    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.MAX;

    this.drawStamp(pixiCtr, layer, pos, width, style.color, alpha, blend);

    this.accumulatedDrawCommands.push({
      commandType: 'initLine',
      pos,
      blendMode: blend,
      strokeStyle: style,
      startWidth: undefined,
      endWidth: undefined,
    });
  }

  onPointerMove(
    e: FederatedPointerEvent,
    pixiCtr: PixiController,
    layerCtr: LayerController
  ) {
    const layer = layerCtr.getActiveLayer();
    if (!layer) return;
    if (this.pan) {
      pixiCtr.moveBoardBy(
        e.movementX / pixiCtr.getScale(),
        e.movementY / pixiCtr.getScale()
      );
      return;
    }
    if (!this.drawing || !this.lastDrawingPosition) return;

    const start = this.lastDrawingPosition;
    const end = pixiCtr.offsetPosition(e.clientX, e.clientY);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist === 0) return;

    const ang = Math.atan2(end.y - start.y, end.x - start.x);
    const sw = this.lastWidth;
    const pressure = e.pointerType !== 'mouse' ? e.pressure : 1;
    const ew = this.pressureSettings.size
      ? this.strokeStyle.width * pressure
      : this.strokeStyle.width;
    const alpha = this.pressureSettings.opacity
      ? this.strokeStyle.alpha * pressure
      : this.strokeStyle.alpha;
    const blend = this.isErasing ? BLEND_MODES.ERASE : BLEND_MODES.MAX;
    const step = Math.min(sw, ew) / 4 || 1;

    for (let i = 0; i <= dist; i += step) {
      const t = i / dist;
      const x = start.x + Math.cos(ang) * i;
      const y = start.y + Math.sin(ang) * i;
      const w = sw + (ew - sw) * t;
      this.drawStamp(
        pixiCtr,
        layer,
        new Point(x, y),
        w,
        this.strokeStyle.color,
        alpha,
        blend
      );
    }
    this.drawStamp(
      pixiCtr,
      layer,
      end,
      ew,
      this.strokeStyle.color,
      alpha,
      blend
    );

    const command: DrawCommand = {
      commandType: 'line',
      pos: end,
      blendMode: blend,
      startWidth: sw,
      endWidth: ew,
      strokeStyle: {
        ...this.strokeStyle,
        alpha,
      },
    };

    this.accumulatedDrawCommands.push(command);

    this.lastDrawingPosition = end;
    this.lastWidth = ew;
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
}
