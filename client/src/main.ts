import {
  Application,
  FederatedPointerEvent,
  Graphics,
  extensions,
  CullerPlugin,
  Container,
  Point,
  RenderTexture,
  Sprite,
  StrokeStyle,
} from 'pixi.js';
import { boardSize, maxScale, minScale, vSub } from './utils';

const init = async () => {
  const app = new Application();
  extensions.add(CullerPlugin);

  await app.init({
    background: '#2b2b2b',
    resizeTo: window,
    antialias: true,
    useBackBuffer: true,
  });

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  document.getElementById('pixi-container')!.appendChild(app.canvas);

  const container = new Container({
    x: app.canvas.width / 2 - boardSize.width / 2,
    y: app.canvas.height / 2 - boardSize.height / 2,
  });

  app.stage.addChild(container);

  const canvasMask = new Graphics()
    .rect(0, 0, boardSize.width, boardSize.height)
    .fill(0xffffff);
  container.mask = canvasMask;

  const canvasBg = new Graphics()
    .rect(0, 0, boardSize.width, boardSize.height)
    .fill(0xffffff);
  container.addChild(canvasMask);
  container.addChild(canvasBg);
  const rt = RenderTexture.create({
    width: boardSize.width,
    height: boardSize.height,
  });
  const sprite = new Sprite(rt);
  container.addChild(sprite);

  window.addEventListener('resize', () => {
    app.resize();
  });

  window.addEventListener('wheel', (e) => {
    const y = e.deltaY > 0 ? -0.1 : 0.1;
    app.stage.scale = app.stage.scale.x + y;
    if (app.stage.scale.x < minScale) app.stage.scale = minScale; // Prevent inverting or too small scale
    if (app.stage.scale.x > maxScale) app.stage.scale = maxScale; // Prevent too big scale
  });

  return { app, container, rt };
};

(async () => {
  const { app, container, rt } = await init();

  const brushSettings: StrokeStyle = {
    width: 10,
    cap: 'round',
    color: 0x000000,
  };

  let stroke: Graphics | null = null;
  let drawing = false;
  let pan = false;
  let isErasing = false;

  const offsetPosition = (x: number, y: number): Point => {
    const stageScale = app.stage.scale.x;
    const pos = new Point(x / stageScale, y / stageScale);
    return vSub(pos, container.position);
  };

  const onPointerDown = (e: FederatedPointerEvent) => {
    const pos = offsetPosition(e.clientX, e.clientY);

    if (e.button === 1) {
      pan = true;
      return;
    }
    if (e.button !== 0) return;
    drawing = true;
    stroke = new Graphics();
    stroke.strokeStyle = brushSettings;
    if (isErasing) {
      stroke.blendMode = 'erase';
    }

    stroke.moveTo(pos.x, pos.y);
    stroke.lineTo(pos.x, pos.y - 0.01);
    stroke.stroke();
    container.addChild(stroke);
  };

  const onPointerMove = (e: FederatedPointerEvent) => {
    const stageScale = app.stage.scale.x;
    if (pan) {
      container.x += e.movementX / stageScale;
      container.y += e.movementY / stageScale;
      return;
    }
    if (!drawing || !stroke) return;
    const pos = offsetPosition(e.clientX, e.clientY);

    stroke.lineTo(pos.x, pos.y);
    stroke.stroke();
  };

  const onPointerUp = () => {
    drawing = false;
    pan = false;
    if (stroke) {
      app.renderer.render({
        container: stroke,
        target: rt,
        clear: false,
      });
      stroke?.destroy();
      stroke = null;
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'e') {
      isErasing = !isErasing;
      console.log('Eraser mode:', isErasing);
    }
  });

  app.stage
    .on('pointerdown', onPointerDown)
    .on('pointermove', onPointerMove)
    .on('pointerup', onPointerUp)
    .on('pointerupoutside', onPointerUp);
})();
