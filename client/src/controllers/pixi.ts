import {
  Application,
  Graphics,
  extensions,
  CullerPlugin,
  Container,
  Point,
  RenderTexture,
  Sprite,
  Texture,
} from 'pixi.js';
import { boardSize, Layer, maxScale, minScale } from '../utils';
import 'pixi.js/math-extras';

export class PixiController {
  app!: Application;
  board!: Container;
  mouse!: Graphics;

  async init() {
    this.app = new Application();
    extensions.add(CullerPlugin);

    await this.app.init({
      background: '#2b2b2b',
      resizeTo: window,
      antialias: true,
      multiView: true,
    });

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    document.getElementById('pixi-container')!.appendChild(this.app.canvas);

    this.board = new Container({
      x: this.app.canvas.width / 2 - boardSize.width / 2,
      y: this.app.canvas.height / 2 - boardSize.height / 2,
    });

    this.app.stage.addChild(this.board);

    const canvasMask = new Graphics()
      .rect(0, 0, boardSize.width, boardSize.height)
      .fill(0xffffff);
    this.board.mask = canvasMask;

    const canvasBg = new Graphics()
      .rect(0, 0, boardSize.width, boardSize.height)
      .fill(0xffffff);

    this.mouse = new Graphics().circle(0, 0, 10);
    this.mouse.stroke(0x2b2b2b);
    this.board.addChild(canvasMask);
    this.board.addChild(canvasBg);
    this.board.addChild(this.mouse);

    window.addEventListener('resize', () => {
      this.app.resize();
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
  }

  private _scale(delta: number) {
    this.app.stage.scale = this.app.stage.scale.x + delta;
    if (this.app.stage.scale.x < minScale) this.app.stage.scale = minScale; // Prevent inverting or too small scale
    if (this.app.stage.scale.x > maxScale) this.app.stage.scale = maxScale; // Prevent too big scale
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
          this.app.renderer.render({
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
    const stageScale = this.app.stage.scale.x;
    const pos = new Point(x / stageScale, y / stageScale);

    return pos.subtract(this.board.position);
  }

  download() {
    let mask = this.board.mask;
    this.board.mask = null;
    this.app.renderer.extract.download(this.app.stage);
    this.board.mask = mask;
  }

  extractBase64(target: RenderTexture | Container): Promise<string> {
    return this.app.renderer.extract.base64({
      format: 'png',
      target: target,
    });
  }

  clearRenderTarget(rt: RenderTexture) {
    const stroke = new Graphics();
    this.app.renderer.render({
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
    this.app.renderer.render({
      container: source,
      target: target,
      clear,
    });
  }

  createNewLayerTextures(title: string) {
    const container = new Container({
      label: title,
    });
    const rt = RenderTexture.create({
      width: this.board.width,
      height: this.board.height,
    });

    const sprite = new Sprite(rt);
    container.addChild(sprite);
    this.board.addChild(container);

    return { container, rt };
  }

  extractTexture(layer: Layer) {
    const newTexture = RenderTexture.create({
      width: boardSize.width,
      height: boardSize.height,
    });

    const s = new Sprite(layer.rt);
    this.app.renderer.render({
      container: s,
      target: newTexture,
    });
    s.destroy();

    return newTexture;
  }

  redrawLayer(layer: Layer, texture: RenderTexture) {
    let stroke = new Graphics();
    this.app.renderer.render({
      container: stroke,
      target: layer.rt,
      clear: true,
    });
    stroke.destroy();

    const s = new Sprite(texture);

    this.app.renderer.render({
      container: s,
      target: layer.rt,
    });

    s.destroy();
  }

  getScale() {
    return this.app.stage.scale.x;
  }

  moveBoardBy(x: number, y: number) {
    this.board.x += x;
    this.board.y += y;
  }

  setMousePosition(point: Point) {
    this.mouse.position = point;
  }

  setMouseSize(radius: number) {
    this.mouse.width = this.mouse.height = radius + 8;
  }
}
