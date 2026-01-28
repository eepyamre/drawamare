import { Identity } from 'spacetimedb';

import { AppEvents, EventBus } from '../events';
import { INetworkController } from '../interfaces';
import {
  Command,
  DbConnection,
  DrawCommand,
  ErrorContext,
  EventContext,
  Layer as ServerLayer,
} from '../module_bindings';
import { DrawingController } from './DrawingController';
import { LayerController } from './LayerController';
import { PixiController } from './PixiController';

export class NetworkController implements INetworkController {
  private static instance: INetworkController;
  static conn: DbConnection | null = null;
  static identity: Identity | null = null;

  constructor() {
    this.initBusListeners();
  }

  static getInstance(): INetworkController {
    if (!this.instance) {
      this.instance = new NetworkController();
    }

    return this.instance;
  }

  connect(): Promise<void> {
    return new Promise<void>((res, rej) => {
      const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
        let count = 0;
        for (const query of queries) {
          conn
            ?.subscriptionBuilder()
            .onApplied(() => {
              count++;
              if (count === queries.length) {
                console.log('SDK client cache initialized.');
              }
            })
            .subscribe(query);
        }
      };

      const onConnect = (
        conn: DbConnection,
        userIdentity: Identity,
        token: string
      ) => {
        NetworkController.identity = userIdentity;
        localStorage.setItem('auth_token', token);
        console.log(
          'Connected to SpacetimeDB with identity:',
          NetworkController.identity.toHexString()
        );

        subscribeToQueries(conn, [
          'SELECT * FROM layer',
          'SELECT * FROM user',
          'SELECT * FROM command',
        ]);
        NetworkController.conn = conn;
        res();
      };

      const onDisconnect = () => {
        // todo
        console.log('Disconnected');
      };

      const onConnectError = (_ctx: ErrorContext, err: Error) => {
        console.log('Error connecting to SpacetimeDB:', err);
        localStorage.removeItem('auth_token');
        rej(err);
      };

      DbConnection.builder()
        .withUri(import.meta.env.VITE_SPACETIME_URL)
        .withModuleName('drawamare')
        .withToken(localStorage.getItem('auth_token') || '')
        .onConnect(onConnect)
        .onConnectError(onConnectError)
        .onDisconnect(onDisconnect)
        .build();
    });
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.NETWORK_DRAW_COMMANDS, this._emitDrawCommands.bind(this));
    bus.on(
      AppEvents.NETWORK_CREATE_LAYER,
      this._emitCreateLayerRequest.bind(this)
    );
    bus.on(
      AppEvents.NETWORK_DELETE_LAYER,
      this._emitDeleteLayerRequest.bind(this)
    );
    bus.on(AppEvents.NETWORK_SAVE_LAYER, this._emitSaveLayerRequest.bind(this));
  }

  getIdentity(): Identity | null {
    return NetworkController.identity;
  }

  getClientDb(): DbConnection['db'] | null {
    return NetworkController.conn?.db || null;
  }

  getReducers(): DbConnection['reducers'] | null {
    return NetworkController.conn?.reducers || null;
  }

  initEventListeners() {
    const layerCtr = LayerController.getInstance();
    const pixiCtr = PixiController.getInstance();
    const drawingCtr = DrawingController.getInstance();

    this.getClientDb()?.command.onInsert(
      (_ctx: EventContext, command: Command) => {
        if (
          !NetworkController.identity ||
          command.owner.isEqual(NetworkController.identity)
        )
          return;
        console.log(
          `Received draw command from ${command.owner
            .toHexString()
            .slice(0, 8)}`
        );

        const layer = layerCtr.getOrCreateLayer(command.layer, command.owner);
        const commands = command.commands;

        drawingCtr.execDrawCommand(layer, commands);
      }
    );

    // redraw
    this.getClientDb()?.layer.onUpdate(
      (_ctx: EventContext, _oldLayer: ServerLayer, newLayer: ServerLayer) => {
        if (
          !newLayer.forceUpdate ||
          !newLayer.base64 ||
          this.confirmLayerIdentity(newLayer) // user's layers is already up to date
        )
          return;
        console.log(`Received update layer command`);
        const l = layerCtr.getOrCreateLayer(newLayer.id, newLayer.owner);

        pixiCtr.clearRenderTarget(l.rt);
        pixiCtr.drawImageFromBase64(newLayer.base64, l.rt);
      }
    );

    this.getClientDb()?.layer.onInsert(
      (_ctx: EventContext, layer: ServerLayer) => {
        console.log(`Received create layer command`);
        const l = layerCtr.createLayer({
          id: layer.id,
          ownerId: layer.owner,
          ownerName: layer.owner.toHexString().slice(0, 8),
          title: layer.name || layer.owner.toHexString().slice(0, 8),
        });

        if (layer.base64) {
          pixiCtr.drawImageFromBase64(layer.base64, l.rt);
        }

        if (this.confirmLayerIdentity(layer)) {
          EventBus.getInstance().emit(AppEvents.LAYER_SELECT, l.id);
        }
      }
    );

    this.getClientDb()?.layer.onDelete(
      (_ctx: EventContext, layer: ServerLayer) => {
        console.log(`Received delete layer command`);

        layerCtr.deleteLayer(layer.id);
      }
    );
  }

  confirmLayerIdentity(layer: ServerLayer) {
    return (
      NetworkController.identity &&
      layer.owner.isEqual(NetworkController.identity)
    );
  }

  _emitDrawCommands(data: { layerId: number; commands: DrawCommand[] }) {
    this.getReducers()?.sendCommand(data.layerId, data.commands);
  }

  _emitCreateLayerRequest() {
    this.getReducers()?.createLayer();
  }

  _emitDeleteLayerRequest(layerId: number) {
    this.getReducers()?.deleteLayer(layerId);
  }

  _emitSaveLayerRequest(data: {
    layerId: number;
    base64: string;
    forceUpdate: boolean;
  }) {
    this.getReducers()?.saveLayer(data.layerId, data.base64, data.forceUpdate);
  }
}
