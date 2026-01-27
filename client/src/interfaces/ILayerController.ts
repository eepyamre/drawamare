import { Container, RenderTexture } from 'pixi.js';
import { Identity } from 'spacetimedb';

import { LayerUI } from '../controllers/UIController';
import { INetworkController, IPixiController } from './';

export type Layer = {
  id: number;
  container: Container;
  rt: RenderTexture;
  ownerId: Identity;
  ownerName: string;
  title: string;
};

export interface ILayerController {
  layers: Map<number, Layer>;
  activeLayer: Layer | null;
  ui: LayerUI;

  init(networkCtr: INetworkController, pixiCtr: IPixiController): void;
  createLayer(
    layerData: Omit<Layer, 'rt' | 'container'>,
    pixiCtr: IPixiController
  ): Layer;
  getLayer(layerId: number): Layer | undefined;
  getOrCreateLayer(
    layerId: number,
    ownerId: Identity,
    pixiCtr: IPixiController
  ): Layer;
  getAllLayers(): Layer[];
  setActiveLayer(layerId: number): Layer | null;
  getActiveLayer(): Layer | null;
  deleteLayer(layerId: number): void;
  clearActiveLayerRenderTarget(pixiCtr: IPixiController): void;
}
