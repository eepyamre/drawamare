import { Identity } from 'spacetimedb';
import {
  Command,
  DbConnection,
  DrawCommand,
  ErrorContext,
  EventContext,
  Layer as ServerLayer,
} from '../module_bindings';
import { LayerController } from './layer';
import { PixiController } from './pixi';
import { DrawingController } from './drawing';

export class NetworkController {
  private conn: DbConnection | null = null;
  private identity: Identity | null = null;

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
        this.identity = userIdentity;
        localStorage.setItem('auth_token', token);
        console.log(
          'Connected to SpacetimeDB with identity:',
          this.identity.toHexString()
        );

        subscribeToQueries(conn, [
          'SELECT * FROM layer',
          'SELECT * FROM user',
          'SELECT * FROM command',
        ]);
        this.conn = conn;
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

  getIdentity(): Identity | null {
    return this.identity;
  }

  getClientDb(): DbConnection['db'] | null {
    return this.conn?.db || null;
  }

  getReducers(): DbConnection['reducers'] | null {
    return this.conn?.reducers || null;
  }

  initEventListeners(
    pixiCtr: PixiController,
    layerCtr: LayerController,
    drawingController: DrawingController
  ) {
    this.getClientDb()?.command.onInsert(
      (_ctx: EventContext, command: Command) => {
        if (!this.identity || command.owner.isEqual(this.identity)) return;
        console.log(
          `Received draw command from ${command.owner
            .toHexString()
            .slice(0, 8)}`
        );

        const layer = layerCtr.getOrCreateLayer(
          command.layer,
          command.owner,
          pixiCtr
        );
        const commands = command.commands;

        drawingController.execDrawCommand(pixiCtr, layer, commands);
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
        const l = layerCtr.getOrCreateLayer(
          newLayer.id,
          newLayer.owner,
          pixiCtr
        );

        pixiCtr.clearRenderTarget(l.rt);
        pixiCtr.drawImageFromBase64(newLayer.base64, l.rt);
      }
    );

    this.getClientDb()?.layer.onInsert(
      (_ctx: EventContext, layer: ServerLayer) => {
        console.log(`Received create layer command`);
        const l = layerCtr.createLayer(
          {
            id: layer.id,
            ownerId: layer.owner,
            ownerName: layer.owner.toHexString().slice(0, 8),
            title: layer.name || layer.owner.toHexString().slice(0, 8),
          },
          pixiCtr
        );

        if (layer.base64) {
          pixiCtr.drawImageFromBase64(layer.base64, l.rt);
        }

        if (this.confirmLayerIdentity(layer)) {
          layerCtr.setActiveLayer(l.id);
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
    return this.identity && layer.owner.isEqual(this.identity);
  }

  emitDrawCommands(layerId: number, commands: DrawCommand[]) {
    this.getReducers()?.sendCommand(layerId, commands);
  }

  emitCreateLayerRequest() {
    this.getReducers()?.createLayer();
  }

  emitDeleteLayerRequest(layerId: number) {
    this.getReducers()?.deleteLayer(layerId);
  }

  emitSaveLayerRequest(layerId: number, base64: string, forceUpdate: boolean) {
    this.getReducers()?.saveLayer(layerId, base64, forceUpdate);
  }
}
