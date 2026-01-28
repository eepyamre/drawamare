import { Point } from 'pixi.js';
import { FederatedPointerEvent } from 'pixi.js';

import { StrokeStyle } from '../module_bindings';
import { DrawCommand } from '../module_bindings';
import { PressureSettings } from '../ui';
import { Tools } from '../utils';
import { Layer } from './';

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

  execDrawCommand(layer: Layer, commands: DrawCommand[]): void;

  onPointerDown(e: FederatedPointerEvent): void;

  onPointerMove(e: FederatedPointerEvent): void;

  onPointerUp(): void;
  setDrawingTool(tool: Tools): void;
  setCurrentColor(hex: string): void;
  setSize(size: number): void;
  setOpacity(opacity: number): void;
  setPressureSettings(settings: PressureSettings): void;
  setPanMode(boolean: boolean): void;
}
