import {
  Application,
  Container,
  CullerPlugin,
  Graphics,
  Point,
  RenderTexture,
  Sprite,
  Texture,
  extensions,
} from 'pixi.js';
import 'pixi.js/math-extras';

import { AppEvents, EventBus } from '../events';
import { IPixiController, Layer } from '../interfaces';
import { boardSize, maxScale, minScale } from '../utils';

export class PixiController implements IPixiController {
  private static instance: IPixiController;
  static app: Application;
  static board: Container;
  static mouse: Graphics;

  static getInstance(): IPixiController {
    if (!this.instance) {
      this.instance = new PixiController();
    }

    return this.instance;
  }

  async init() {
    PixiController.app = new Application();
    extensions.add(CullerPlugin);

    await PixiController.app.init({
      background: '#2b2b2b',
      resizeTo: window,
      antialias: true,
      multiView: true,
    });

    PixiController.app.stage.eventMode = 'static';

    document
      .getElementById('pixi-container')!
      .appendChild(PixiController.app.canvas);

    PixiController.board = new Container({
      x: PixiController.app.canvas.width / 2 - boardSize.width / 2,
      y: PixiController.app.canvas.height / 2 - boardSize.height / 2,
    });

    PixiController.app.stage.addChild(PixiController.board);

    const canvasMask = new Graphics()
      .rect(0, 0, boardSize.width, boardSize.height)
      .fill(0xffffff);
    PixiController.board.mask = canvasMask;

    const canvasBg = new Graphics()
      .rect(0, 0, boardSize.width, boardSize.height)
      .fill(0xffffff);

    PixiController.mouse = new Graphics().circle(0, 0, 10);
    PixiController.mouse.zIndex = 10;
    PixiController.mouse.stroke(0x2b2b2b);
    PixiController.board.addChild(canvasMask);
    PixiController.board.addChild(canvasBg);
    PixiController.board.addChild(PixiController.mouse);

    window.addEventListener('resize', () => {
      PixiController.app.resize();
    });

    window.addEventListener('wheel', (e) => {
      this.scale(e.deltaY);
    });

    let scaleMode = false;
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && (e.ctrlKey || e.metaKey)) scaleMode = true;
    });

    window.addEventListener('keyup', () => {
      scaleMode = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (scaleMode && e.buttons !== 0) this._scale(-e.movementY / 500);
    });

    this.initBusListeners();
  }

  initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.CANVAS_ZOOM_IN, this.scale.bind(this, -1));
    bus.on(AppEvents.CANVAS_ZOOM_OUT, this.scale.bind(this, 1));
    bus.on(AppEvents.CANVAS_DOWNLOAD, this.download.bind(this));
    bus.on(AppEvents.BRUSH_SIZE_CHANGE, this.setMouseSize.bind(this));
    bus.on(AppEvents.LAYER_CLEAR_ACTIVE, this._clearLayer.bind(this));
  }

  _clearLayer(activeLayer: Layer | null) {
    if (!activeLayer) return;
    const bus = EventBus.getInstance();

    this.clearRenderTarget(activeLayer.rt);
    this.extractBase64(activeLayer.rt).then((data) => {
      bus.emit(AppEvents.NETWORK_SAVE_LAYER, {
        layerId: activeLayer.id,
        base64: data,
        forceUpdate: true,
      });
    });
  }

  _scale(delta: number) {
    PixiController.app.stage.scale = PixiController.app.stage.scale.x + delta;
    if (PixiController.app.stage.scale.x < minScale)
      PixiController.app.stage.scale = minScale; // Prevent inverting or too small scale
    if (PixiController.app.stage.scale.x > maxScale)
      PixiController.app.stage.scale = maxScale; // Prevent too big scale
  }

  scale(delta: number) {
    const y = delta > 0 ? -0.1 : 0.1;
    this._scale(y);
  }

  drawImageFromBase64(base64: string, rt: RenderTexture): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64;

      img.onload = () => {
        try {
          const texture = Texture.from(img);
          const s = new Sprite(texture);
          PixiController.app.renderer.render({
            container: s,
            target: rt,
          });
          s.destroy();
          texture.destroy();
          img.remove();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = (err) => {
        img.remove();
        reject(new Error(`Failed to load image from base64: ${err}`));
      };
    });
  }

  offsetPosition(x: number, y: number): Point {
    const stageScale = PixiController.app.stage.scale.x;
    const pos = new Point(x / stageScale, y / stageScale);

    return pos.subtract(PixiController.board.position);
  }

  download() {
    const mask = PixiController.board.mask;
    PixiController.board.mask = null;
    PixiController.app.renderer.extract.download(PixiController.app.stage);
    PixiController.board.mask = mask;
  }

  extractBase64(target: RenderTexture | Container): Promise<string> {
    return PixiController.app.renderer.extract.base64({
      format: 'png',
      target: target,
    });
  }

  clearRenderTarget(rt: RenderTexture) {
    const stroke = new Graphics();
    PixiController.app.renderer.render({
      container: stroke,
      target: rt,
      clear: true,
    });
    stroke.destroy();
  }

  renderToTarget(
    source: Container,
    target: RenderTexture,
    clear: boolean = false
  ) {
    PixiController.app.renderer.render({
      container: source,
      target,
      clear,
    });
  }

  createNewLayerTextures(title: string) {
    const container = new Container({
      label: title,
    });
    const rt = RenderTexture.create({
      width: PixiController.board.width,
      height: PixiController.board.height,
    });

    const sprite = new Sprite(rt);
    container.addChild(sprite);
    PixiController.board.addChild(container);

    return { container, rt };
  }

  extractTexture(layer: Layer) {
    const newTexture = RenderTexture.create({
      width: boardSize.width,
      height: boardSize.height,
    });

    const s = new Sprite(layer.rt);
    PixiController.app.renderer.render({
      container: s,
      target: newTexture,
    });
    s.destroy();

    return newTexture;
  }

  redrawLayer(layer: Layer, texture: RenderTexture) {
    const stroke = new Graphics();
    PixiController.app.renderer.render({
      container: stroke,
      target: layer.rt,
      clear: true,
    });
    stroke.destroy();

    const s = new Sprite(texture);

    PixiController.app.renderer.render({
      container: s,
      target: layer.rt,
    });

    s.destroy();
  }

  getScale() {
    return PixiController.app.stage.scale.x;
  }

  moveBoardBy(x: number, y: number) {
    PixiController.board.x += x;
    PixiController.board.y += y;
  }

  setMousePosition(point: Point) {
    PixiController.mouse.position = point;
  }

  setMouseSize(radius: number) {
    PixiController.mouse.width = PixiController.mouse.height =
      radius > 4 ? radius + 8 : radius + 4;
  }
}
