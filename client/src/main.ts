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
  RenderLayer,
} from 'pixi.js';
import io, { Socket } from 'socket.io-client';
import { boardSize, maxHistoryLength, maxScale, minScale, vSub } from './utils';

type DrawCommand =
  | {
      command: 'initLine';
      blendMode?: 'erase' | 'normal';
      pos: Point;
      strokeStyle: StrokeStyle;
    }
  | {
      command: 'line';
      pos: Point;
    }
  | {
      command: 'endLine';
    };

type CommandBlock = DrawCommand[];
type History = RenderTexture[];

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

  const rt = RenderTexture.create({
    width: boardSize.width,
    height: boardSize.height,
  });
  const sprite = new Sprite(rt);
  const container = new Container({
    x: 0,
    y: 0,
    width: board.width,
    height: board.height,
  });
  container.addChild(sprite);
  board.addChild(container);
  window.addEventListener('resize', () => {
    app.resize();
  });

  window.addEventListener('wheel', (e) => {
    const y = e.deltaY > 0 ? -0.1 : 0.1;
    app.stage.scale = app.stage.scale.x + y;
    if (app.stage.scale.x < minScale) app.stage.scale = minScale; // Prevent inverting or too small scale
    if (app.stage.scale.x > maxScale) app.stage.scale = maxScale; // Prevent too big scale
  });

  return { app, board, container, rt };
};

type DrawCommandPayload = {
  userId: string;
  commands: DrawCommand[];
};

const userLayers = new Map<
  string,
  {
    container: Container;
    rt: RenderTexture;
  }
>();

const socketEventHandler = (
  socket: Socket,
  app: Application,
  board: Container
) => {
  socket.on('drawCommand', (payload: DrawCommandPayload) => {
    console.log(`Received draw command from ${payload.userId}`);

    let layer = userLayers.get(payload.userId);
    if (!layer) {
      layer = {
        container: new Container({
          label: `Layer ${payload.userId}`,
        }),
        rt: RenderTexture.create({
          width: board.width,
          height: board.height,
        }),
      };
      const sprite = new Sprite(layer.rt);
      layer.container.addChild(sprite);
      board.addChild(layer.container);

      userLayers.set(payload.userId, layer);
    }

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
};

(async () => {
  const socket = await connect();
  if (!socket.id) throw new Error('Socket ID not found');

  const { app, board, container, rt } = await init();
  socketEventHandler(socket, app, board);

  userLayers.set(socket.id, {
    container,
    rt,
  });

  let historyStack: History = [];
  let redoStack: History = [];

  const saveState = () => {
    const newTexture = RenderTexture.create({
      width: boardSize.width,
      height: boardSize.height,
    });

    const s = new Sprite(rt);
    app.renderer.render({
      container: s,
      target: newTexture,
    });
    s.destroy();
    historyStack.push(newTexture);
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
    container.addChild(stroke);
  };

  const onPointerMove = (e: FederatedPointerEvent) => {
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
    drawing = false;
    pan = false;
    if (stroke) {
      app.renderer.render({
        container: stroke,
        target: rt,
        clear: false,
      });

      saveState();

      stroke?.destroy();
      stroke = null;

      const command: DrawCommand = {
        command: 'endLine',
      };

      lastCommands.push(command);

      socket.emit('drawCommand', lastCommands);

      lastCommands = [];

      if (historyStack.length > maxHistoryLength) {
        historyStack = historyStack.slice(-maxHistoryLength);
      }
    }
  };

  const redrawCanvas = (texture: RenderTexture) => {
    let stroke = new Graphics();
    app.renderer.render({
      container: stroke,
      target: rt,
      clear: true,
    });
    stroke.destroy();

    const s = new Sprite(texture);

    app.renderer.render({
      container: s,
      target: rt,
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
      console.log('Eraser mode:', isErasing);
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
