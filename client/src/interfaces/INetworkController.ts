import { Identity } from 'spacetimedb';

import { DbConnection, DrawCommand, Layer } from '../module_bindings';
import {
  IBrushController,
  IDrawingController,
  ILayerController,
  IPixiController,
} from './';

export interface INetworkController {
  conn: DbConnection | null;
  identity: Identity | null;

  connect(): Promise<void>;
  getIdentity(): Identity | null;
  getClientDb(): DbConnection['db'] | null;
  getReducers(): DbConnection['reducers'] | null;
  initEventListeners(
    pixiCtr: IPixiController,
    layerCtr: ILayerController,
    drawingController: IDrawingController,
    brushCtr: IBrushController
  ): void;
  initBusListeners(): void;
  confirmLayerIdentity(layer: Layer): void;
  _emitDrawCommands(data: { layerId: number; commands: DrawCommand[] }): void;
  _emitCreateLayerRequest(): void;
  _emitDeleteLayerRequest(layerId: number): void;
  _emitSaveLayerRequest(data: {
    layerId: number;
    base64: string;
    forceUpdate: boolean;
  }): void;
}
