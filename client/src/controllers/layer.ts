import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { Layer } from '../utils';
import { PixiController } from './pixi';
import { LayerUI } from './ui';
import { NetworkController } from './network';

export class LayerController {
  private layers = new Map<number, Layer>();
  private activeLayer: Layer | null = null;
  private ui: LayerUI;
  constructor(ui: LayerUI) {
    this.ui = ui;
  }

  init(networkCtr: NetworkController, pixiCtr: PixiController) {
    const identity = networkCtr.getIdentity();
    for (const layer of networkCtr.getClientDb()!.layer.iter()) {
      const { base64, id, owner, name } = layer;

      let l = this.getLayer(id);

      if (!l) {
        l = this.createLayer(
          {
            id,
            ownerId: owner,
            ownerName: owner.toHexString().slice(0, 8),
            title: name || owner.toHexString().slice(0, 8),
          },
          pixiCtr
        );
      }
      if (base64) pixiCtr.drawImageFromBase64(base64, l!.rt);
    }

    const existingLayer = Array.from(this.layers.entries()).find(
      ([_key, item]) => identity && item.ownerId.isEqual(identity)
    );
    if (existingLayer) {
      this.activeLayer = existingLayer[1];
    } else {
      networkCtr.emitCreateLayerRequest();
    }
  }

  createLayer(
    layerData: Omit<Layer, 'rt' | 'container'>,
    pixiCtr: PixiController
  ): Layer {
    const { container, rt } = pixiCtr.createNewLayerTextures(layerData.title);

    const l = {
      id: layerData.id,
      ownerId: layerData.ownerId,
      ownerName: layerData.ownerId.toHexString().slice(0, 8), //TODO:
      title: layerData.ownerId.toHexString().slice(0, 8), //TODO: get title from server
      container,
      rt,
    };

    this.layers.set(l.id, l);
    this.ui.renderLayers(Array.from(this.layers.values()));
    this.activeLayer?.id && this.ui.setActiveLayer(this.activeLayer.id);
    return l;
  }

  getLayer(layerId: number): Layer | undefined {
    return this.layers.get(layerId);
  }

  getOrCreateLayer(
    layerId: number,
    ownerId: Identity,
    pixiCtr: PixiController
  ): Layer {
    let layer = this.getLayer(layerId);
    if (!layer) {
      layer = this.createLayer(
        {
          id: layerId,
          ownerId: ownerId,
          ownerName: ownerId.toHexString().slice(0, 8),
          title: `Layer ${ownerId}`,
        },
        pixiCtr
      );
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
    this.ui.setActiveLayer(layerId);

    return layer;
  }

  getActiveLayer(): Layer | null {
    return this.activeLayer;
  }

  deleteLayer(layerId: number) {
    const l = this.layers.get(layerId);
    l?.container.destroy();
    this.layers.delete(layerId);
    this.ui.renderLayers(this.getAllLayers());
  }

  clearActiveLayerRenderTarget(pixiCtr: PixiController) {
    if (this.activeLayer?.rt) pixiCtr.clearRenderTarget(this.activeLayer?.rt);
  }
}
