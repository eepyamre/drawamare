import {
  Application,
  FederatedPointerEvent,
  Graphics,
  extensions,
  CullerPlugin,
  Container,
  Point,
  PointData,
  RenderTexture,
  Sprite,
} from 'pixi.js';

const vAdd = (v: PointData, w: PointData): Point => {
  return new Point(v.x + w.x, v.y + w.y);
};

const vSub = (v: PointData, w: PointData): Point => {
  return new Point(v.x - w.x, v.y - w.y);
};

const boardSize = {
  width: 768,
  height: 768,
};

(async () => {
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
  let stroke: Graphics | null = null;
  let drawing = false;
  let pan = false;
  let isErasing = false;

  const onPointerDown = (e: FederatedPointerEvent) => {
    const stageScale = app.stage.scale.x;
    let pos = new Point(e.clientX / stageScale, e.clientY / stageScale);
    pos = vSub(pos, container.position);
    if (e.button === 1) {
      pan = true;
      return;
    }
    if (e.button !== 0) return;
    drawing = true;
    stroke = new Graphics();
    stroke.strokeStyle.width = 10;
    stroke.strokeStyle.cap = 'round';
    stroke.strokeStyle.color = 0x000000;
    if (isErasing) {
      stroke.strokeStyle.color = 0xff0000;
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
    let pos = new Point(e.clientX / stageScale, e.clientY / stageScale);
    pos = vSub(pos, container.position);
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

  window.addEventListener('resize', () => {
    app.resize();
  });

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

  app.stage.on('wheel', (e) => {
    const y = e.deltaY > 0 ? -0.1 : 0.1;
    app.stage.scale = app.stage.scale.x + y;
    if (app.stage.scale.x < 0.5) app.stage.scale = 0.5; // Prevent inverting or too small scale
    if (app.stage.scale.x > 3) app.stage.scale = 3; // Prevent too big scale
  });
})();
