import {
  Application,
  Container,
  Graphics,
  Point,
  RenderTexture,
} from 'pixi.js';

import { Layer } from './ILayerController';

export interface IPixiController {
  app: Application;
  board: Container;
  mouse: Graphics;

  init(): Promise<void>;
  initBusListeners(): void;
  _scale(delta: number): void;
  scale(delta: number): void;
  drawImageFromBase64(base64: string, rt: RenderTexture): Promise<void>;
  offsetPosition(x: number, y: number): Point;
  download(): void;
  extractBase64(target: RenderTexture | Container): Promise<string>;
  clearRenderTarget(rt: RenderTexture): void;
  renderToTarget(
    source: Container,
    target: RenderTexture,
    clear: boolean
  ): void;
  createNewLayerTextures(title: string): {
    container: Container;
    rt: RenderTexture;
  };
  extractTexture(layer: Layer): RenderTexture;
  redrawLayer(layer: Layer, texture: RenderTexture): void;
  getScale(): number;
  moveBoardBy(x: number, y: number): void;
  setMousePosition(point: Point): void;
  setMouseSize(radius: number): void;
}
