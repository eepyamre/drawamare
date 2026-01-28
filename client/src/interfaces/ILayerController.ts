import { Container, RenderTexture } from 'pixi.js';
import { Identity } from 'spacetimedb';

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

  init(): void;
  initBusListeners(): void;
  createLayer(layerData: Omit<Layer, 'rt' | 'container'>): Layer;
  getLayer(layerId: number): Layer | undefined;
  getOrCreateLayer(layerId: number, ownerId: Identity): Layer;
  getAllLayers(): Layer[];
  setActiveLayer(layerId: number): Layer | null;
  getActiveLayer(): Layer | null;
  deleteLayer(layerId: number): void;
}
