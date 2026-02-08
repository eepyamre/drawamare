import { Identity } from 'spacetimedb';

import { AppEvents, EventBus } from '../events';
import { ILayerController, Layer } from '../interfaces/ILayerController';
import { NetworkController } from './NetworkController';
import { PixiController } from './PixiController';

export class LayerController implements ILayerController {
  private static instance: ILayerController;
  layers = new Map<number, Layer>();
  activeLayer: Layer | null = null;

  constructor() {
    this.initBusListeners();
    this.init();
  }

  static getInstance(): ILayerController {
    if (!this.instance) {
      this.instance = new LayerController();
    }

    return this.instance;
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.LAYER_DELETE, this.deleteLayer.bind(this));
    bus.on(AppEvents.LAYER_SELECT, this.setActiveLayer.bind(this));
  }

  init() {
    const networkCtr = NetworkController.getInstance();
    const identity = networkCtr.getIdentity();
    for (const layer of networkCtr.getClientDb()!.layer.iter()) {
      const { base64, id, owner, name } = layer;

      let l = this.getLayer(id);

      if (!l) {
        l = this.createLayer({
          id,
          ownerId: owner,
          ownerName: owner.toHexString().slice(0, 8),
          title: name || owner.toHexString().slice(0, 8),
        });
      }
      if (base64)
        PixiController.getInstance().drawImageFromBase64(base64, l!.rt);
    }

    const existingLayer = Array.from(this.layers.entries()).find(
      ([_key, item]) => identity && item.ownerId.isEqual(identity)
    );
    if (existingLayer) {
      this.activeLayer = existingLayer[1];
    }
    EventBus.getInstance().emit(AppEvents.LAYERS_RERENDER, this.getAllLayers());
  }

  createLayer(layerData: Omit<Layer, 'rt' | 'container'>): Layer {
    const { container, rt } =
      PixiController.getInstance().createNewLayerTextures(layerData.title);

    const l = {
      id: layerData.id,
      ownerId: layerData.ownerId,
      ownerName: layerData.ownerId.toHexString().slice(0, 8), //TODO:
      title: layerData.ownerId.toHexString().slice(0, 8), //TODO: get title from server
      container,
      rt,
    };

    this.layers.set(l.id, l);
    EventBus.getInstance().emit(
      AppEvents.LAYERS_RERENDER,
      Array.from(this.layers.values())
    );
    if (this.activeLayer?.id) {
      EventBus.getInstance().emit(
        AppEvents.LAYER_ACTIVATED,
        this.activeLayer.id
      );
    }
    return l;
  }

  getLayer(layerId: number): Layer | undefined {
    return this.layers.get(layerId);
  }

  getOrCreateLayer(layerId: number, ownerId: Identity): Layer {
    let layer = this.getLayer(layerId);
    if (!layer) {
      layer = this.createLayer({
        id: layerId,
        ownerId: ownerId,
        ownerName: ownerId.toHexString().slice(0, 8),
        title: `Layer ${ownerId}`,
      });
    }
    return layer;
  }

  getAllLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  setActiveLayer(layerId: number): Layer | null {
    const layer = this.getLayer(layerId);
    if (!layer) return null;

    this.activeLayer = layer;
    EventBus.getInstance().emit(AppEvents.LAYER_ACTIVATED, layerId);

    return layer;
  }

  getActiveLayer(): Layer | null {
    return this.activeLayer;
  }

  deleteLayer(layerId: number) {
    const l = this.layers.get(layerId);
    l?.container.destroy();
    this.layers.delete(layerId);
    EventBus.getInstance().emit(AppEvents.LAYERS_RERENDER, this.getAllLayers());
  }
}
