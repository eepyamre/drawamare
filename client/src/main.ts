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
  Texture,
} from 'pixi.js';
import io, { Socket } from 'socket.io-client';
import { v4 } from 'uuid';
import {
  boardSize,
  CommandBlock,
  DrawCommand,
  DrawCommandPayload,
  maxHistoryLength,
  maxScale,
  minScale,
  RedrawPayload,
  UserLayersPayload,
  vSub,
  History,
  Layer,
} from './utils';

const layers = new Map<
  string, // layer id
  Layer
>();
let activeLayer: Layer | null = null;

const connect = async () => {
  return new Promise<Socket>((resolve) => {
    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      console.log('Connected to server');
      resolve(socket);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      // TODO: Handle disconnection gracefully
    });
  });
};

const init = async () => {
  // const id = v4();
  const app = new Application();
  extensions.add(CullerPlugin);

  await app.init({
    background: '#2b2b2b',
    resizeTo: window,
    antialias: true,
    multiView: true,
  });

  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  document.getElementById('pixi-container')!.appendChild(app.canvas);

  const board = new Container({
    x: app.canvas.width / 2 - boardSize.width / 2,
    y: app.canvas.height / 2 - boardSize.height / 2,
  });

  app.stage.addChild(board);

  const canvasMask = new Graphics()
    .rect(0, 0, boardSize.width, boardSize.height)
    .fill(0xffffff);
  board.mask = canvasMask;

  const canvasBg = new Graphics()
    .rect(0, 0, boardSize.width, boardSize.height)
    .fill(0xffffff);
  board.addChild(canvasMask);
  board.addChild(canvasBg);
  window.addEventListener('resize', () => {
    app.resize();
  });

  window.addEventListener('wheel', (e) => {
    const y = e.deltaY > 0 ? -0.1 : 0.1;
    app.stage.scale = app.stage.scale.x + y;
    if (app.stage.scale.x < minScale) app.stage.scale = minScale; // Prevent inverting or too small scale
    if (app.stage.scale.x > maxScale) app.stage.scale = maxScale; // Prevent too big scale
  });

  return { app, board };
};

const getOrCreateLayer = (userId: string, board: Container) => {
  let layer = Array.from(layers.values()).find(
    (item) => item.ownerId === userId
  );
  if (!layer) {
    const id = v4();
    layer = {
      id,
      ownerId: userId,
      ownerName: userId, //TODO:
      title: `Layer ${userId}`,
      container: new Container({
        label: `Layer ${userId}`,
      }),
      rt: RenderTexture.create({
        width: board.width,
        height: board.height,
      }),
    };
    const sprite = new Sprite(layer.rt);
    layer.container.addChild(sprite);
    board.addChild(layer.container);

    layers.set(layer.id, layer);
  }
  return layer;
};

const drawImageFromBase64 = (
  app: Application,
  base64: string,
  rt: RenderTexture
) => {
  const img = new Image();
  img.src = base64;
  img.onload = () => {
    const texture = Texture.from(img);
    const s = new Sprite(texture);

    app.renderer.render({
      container: s,
      target: rt,
    });

    s.destroy();
    texture.destroy();
    img.remove();
  };
};

const socketEventHandler = (
  socket: Socket,
  app: Application,
  board: Container
) => {
  socket.on('drawCommand', (payload: DrawCommandPayload) => {
    console.log(`Received draw command from ${payload.userId}`);

    const layer = getOrCreateLayer(payload.userId, board);

    const commands = payload.commands;

    let stroke = new Graphics();
    commands.forEach((commandBlock) => {
      switch (commandBlock.command) {
        case 'initLine': {
          stroke.destroy();
          stroke = new Graphics();
          const pos = commandBlock.pos;
          stroke.strokeStyle = commandBlock.strokeStyle;
          stroke.blendMode = commandBlock.blendMode || 'normal';
          stroke.moveTo(pos.x, pos.y);
          stroke.lineTo(pos.x, pos.y - 0.01);
          stroke.stroke();
          layer.container.addChild(stroke);
          break;
        }
        case 'line': {
          const pos = commandBlock.pos;
          stroke.lineTo(pos.x, pos.y);
          stroke.stroke();
          break;
        }
        case 'endLine':
          {
            app.renderer.render({
              container: stroke,
              target: layer.rt,
              clear: false,
            });
            stroke.destroy();
          }
          break;
        default:
          break;
      }
    });
    stroke.destroy();
  });

  socket.on('redraw', (payload: RedrawPayload) => {
    console.log(`Received redraw command from ${payload.userId}`);
    const layer = getOrCreateLayer(payload.userId, board);
    let stroke = new Graphics();
    app.renderer.render({
      container: stroke,
      target: layer.rt,
      clear: true,
    });
    stroke.destroy();

    drawImageFromBase64(app, payload.base64, layer.rt);
  });

  socket.on('userLayers', (payload: UserLayersPayload) => {
    console.log(`Received userLayers command`);
    payload.forEach((item) => {
      const { userId, base64 } = item;
      const layer = getOrCreateLayer(userId, board);
      drawImageFromBase64(app, base64, layer.rt);
    });
  });
};
(async () => {
  const socket = await connect();
  if (!socket.id) throw new Error('Socket ID not found');

  const { app, board } = await init();
  socketEventHandler(socket, app, board);

  socket.emit('getLayers');
  socket.emit('getUsers');

  const existingLayer = Array.from(layers.entries()).find(
    ([_key, item]) => item.ownerId === socket.id
  );
  if (existingLayer) {
    activeLayer = existingLayer[1];
  } else {
    activeLayer = getOrCreateLayer(socket.id, board);
  }

  // TODO: on layer change clear the history
  let historyStack: History = [];
  let redoStack: History = [];

  const saveState = () => {
    if (!activeLayer) return;

    const newTexture = RenderTexture.create({
      width: boardSize.width,
      height: boardSize.height,
    });

    const s = new Sprite(activeLayer.rt);
    app.renderer.render({
      container: s,
      target: newTexture,
    });
    s.destroy();
    historyStack.push(newTexture);
  };

  const saveAndEmitLayer = (redraw?: boolean) => {
    if (!activeLayer) return;

    app.renderer.extract
      .base64({
        format: 'png',
        target: activeLayer.rt,
      })
      .then((data) => {
        socket.emit(redraw ? 'redraw' : 'saveLayer', {
          timestamp: Date.now(),
          base64: data,
        });
      });
  };

  saveState();

  const strokeStyle: StrokeStyle = {
    width: 10,
    cap: 'round',
    color: 0x000000,
  };

  let stroke: Graphics | null = null;
  let drawing = false;
  let pan = false;
  let isErasing = false;
  let lastCommands: CommandBlock = [];

  const offsetPosition = (x: number, y: number): Point => {
    const stageScale = app.stage.scale.x;
    const pos = new Point(x / stageScale, y / stageScale);
    return vSub(pos, board.position);
  };

  const onPointerDown = (e: FederatedPointerEvent) => {
    if (!activeLayer) return;

    const pos = offsetPosition(e.clientX, e.clientY);

    if (e.button === 1) {
      pan = true;
      return;
    }
    if (e.button !== 0) return;
    redoStack = [];
    const command: DrawCommand = {
      command: 'initLine',
      pos,
      blendMode: 'normal',
      strokeStyle: { ...strokeStyle },
    };

    drawing = true;
    stroke = new Graphics();
    stroke.strokeStyle = { ...strokeStyle };
    if (isErasing) {
      command.blendMode = stroke.blendMode = 'erase';
    }

    lastCommands.push(command);
    stroke.moveTo(pos.x, pos.y);
    stroke.lineTo(pos.x, pos.y - 0.01);
    stroke.stroke();
    activeLayer.container.addChild(stroke);
  };

  const onPointerMove = (e: FederatedPointerEvent) => {
    if (!activeLayer) return;

    const stageScale = app.stage.scale.x;
    if (pan) {
      board.x += e.movementX / stageScale;
      board.y += e.movementY / stageScale;
      return;
    }
    if (!drawing || !stroke) return;
    const pos = offsetPosition(e.clientX, e.clientY);
    const command: DrawCommand = {
      command: 'line',
      pos,
    };

    lastCommands.push(command);
    stroke.lineTo(pos.x, pos.y);
    stroke.stroke();
  };

  const onPointerUp = () => {
    if (!activeLayer) return;

    drawing = false;
    pan = false;
    if (stroke) {
      app.renderer.render({
        container: stroke,
        target: activeLayer.rt,
        clear: false,
      });

      saveState();

      stroke?.destroy();
      stroke = null;

      const command: DrawCommand = {
        command: 'endLine',
      };

      lastCommands.push(command);
      if (!isErasing) {
        socket.emit('drawCommand', lastCommands);
      }
      saveAndEmitLayer(isErasing);
      lastCommands = [];

      if (historyStack.length > maxHistoryLength) {
        historyStack = historyStack.slice(-maxHistoryLength);
      }
    }
  };

  const redrawCanvas = (texture: RenderTexture) => {
    if (!activeLayer) return;

    let stroke = new Graphics();
    app.renderer.render({
      container: stroke,
      target: activeLayer.rt,
      clear: true,
    });
    stroke.destroy();

    const s = new Sprite(texture);

    app.renderer.render({
      container: s,
      target: activeLayer.rt,
    });
    app.renderer.extract
      .base64({
        format: 'png',
        target: activeLayer.rt,
      })
      .then((data) => {
        socket.emit('redraw', {
          timestamp: Date.now(),
          base64: data,
        });
      });

    s.destroy();
  };
  const undo = () => {
    if (historyStack.length <= 1) {
      console.log('No commands to undo');
      return;
    }

    const lastItem = historyStack.pop();
    if (lastItem) {
      redoStack.push(lastItem);
      const previousState = historyStack[historyStack.length - 1];
      redrawCanvas(previousState);
    }
  };

  const redo = () => {
    if (redoStack.length <= 0) {
      console.log('No commands to redo');
      return;
    }

    const lastItem = redoStack.pop();
    if (lastItem) {
      historyStack.push(lastItem);
      redrawCanvas(lastItem);
    }
  };

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'e') {
      isErasing = !isErasing;
    }
    if (key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  });

  app.stage
    .on('pointerdown', onPointerDown)
    .on('pointermove', onPointerMove)
    .on('pointerup', onPointerUp)
    .on('pointerupoutside', onPointerUp);
})();
