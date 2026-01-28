import { Identity } from 'spacetimedb';

import { DbConnection, DrawCommand, Layer } from '../module_bindings';

export interface INetworkController {
  connect(): Promise<void>;
  getIdentity(): Identity | null;
  getClientDb(): DbConnection['db'] | null;
  getReducers(): DbConnection['reducers'] | null;
  initEventListeners(): void;
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
