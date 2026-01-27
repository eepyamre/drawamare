import { Point } from 'pixi.js';
import { FederatedPointerEvent } from 'pixi.js';

import { StrokeStyle } from '../module_bindings';
import { DrawCommand } from '../module_bindings';
import { PressureSettings } from '../ui';
import { Tools } from '../utils';
import {
  IBrushController,
  IHistoryController,
  ILayerController,
  IPixiController,
  Layer,
} from './';

export interface IDrawingController {
  strokeStyle: StrokeStyle;
  isErasing: boolean;
  drawing: boolean;
  pan: boolean;

  lastDrawingPosition: Point | null;
  lastWidth: number;
  lastAlpha: number;
  accumulatedDrawCommands: DrawCommand[];
  pressureSettings: PressureSettings;

  initBusListeners(): void;

  execDrawCommand(
    pixiCtr: IPixiController,
    brushCtr: IBrushController,
    layer: Layer,
    commands: DrawCommand[]
  ): void;

  onPointerDown(
    e: FederatedPointerEvent,
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    historyCtr: IHistoryController,
    brushCtr: IBrushController
  ): void;

  onPointerMove(
    e: FederatedPointerEvent,
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    brushCtr: IBrushController
  ): void;

  onPointerUp(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    historyCtr: IHistoryController,
    brushCtr: IBrushController
  ): void;
  setDrawingTool(tool: Tools): void;
  setCurrentColor(hex: string): void;
  setSize(size: number): void;
  setOpacity(opacity: number): void;
  setPressureSettings(settings: PressureSettings): void;
  setPanMode(boolean: boolean): void;
}
