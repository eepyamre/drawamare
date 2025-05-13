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
import {
  boardSize,
  maxHistoryLength,
  maxScale,
  minScale,
  vSub,
  History,
  Layer,
  checkBlendModes,
  distance,
} from './utils';
import { LayerUI, ToolbarUI, Tools } from './ui';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import {
  Command,
  DbConnection,
  ErrorContext,
  EventContext,
  Layer as ServerLayer,
  DrawCommand,
} from './module_bindings';

// Layers
const layers = new Map<
  number, // layer id
  Layer
>();
const getLayer = (layerId: number) => {
  return Array.from(layers.values()).find((item) => item.id === layerId);
};

const createLayer = (
  layer: Omit<Layer, 'rt' | 'container'>,
  board: Container
) => {
  const l = {
    id: layer.id,
    ownerId: layer.ownerId,
    ownerName: layer.ownerId.toHexString().slice(0, 8), //TODO:
    title: layer.title, //TODO: get title from server
    container: new Container({
      label: layer.title,
    }),
    rt: RenderTexture.create({
      width: board.width,
      height: board.height,
    }),
  };

  const sprite = new Sprite(l.rt);
  l.container.addChild(sprite);
  board.addChild(l.container);

  layers.set(l.id, l);
  ui.renderLayers(Array.from(layers.values()));
  activeLayer?.id && ui.setActiveLayer(activeLayer.id);
  return l;
};

const initLayers = (conn: DbConnection, app: Application, board: Container) => {
  for (const layer of conn.db.layer.iter()) {
    const { base64, id, owner, name } = layer;

    let l = getLayer(id);

    if (!l) {
      l = createLayer(
        {
          id,
          ownerId: owner,
          ownerName: owner.toHexString().slice(0, 8),
          title: name || owner.toHexString().slice(0, 8),
        },
        board
      );
    }
    if (base64) drawImageFromBase64(app, base64, l.rt);
  }

  const existingLayer = Array.from(layers.entries()).find(
    ([_key, item]) => identity && item.ownerId.isEqual(identity)
  );
  if (existingLayer) {
    activeLayer = existingLayer[1];
  } else {
    conn.reducers.createLayer();
  }
};

const getOrCreateLayer = (
  layerId: number,
  ownerId: Identity,
  board: Container
) => {
  let layer = getLayer(layerId);
  if (!layer) {
    layer = createLayer(
      {
        id: layerId,
        ownerId: ownerId,
        ownerName: ownerId.toHexString().slice(0, 8),
        title: `Layer ${ownerId}`,
      },
      board
    );
  }
  return layer;
};
// Layers End

let activeLayer: Layer | null = null;

let identity: Identity | null = null;

const socketEventHandler = (
  conn: DbConnection,
  app: Application,
  board: Container
) => {
  conn.db.command.onInsert((_ctx: EventContext, command: Command) => {
    if (!identity || command.owner.isEqual(identity)) return;
    console.log(
      `Received draw command from ${command.owner.toHexString().slice(0, 8)}`
    );

    const layer = getOrCreateLayer(command.layer, command.owner, board);

    const commands = command.commands;

    let stroke = new Graphics();
    console.log(activeLayer);
    let lastPos: Point;
    commands.forEach((commandBlock) => {
      switch (commandBlock.commandType) {
        case 'initLine': {
          if (!commandBlock.pos) return;
          stroke.destroy();
          stroke = new Graphics();
          const pos = commandBlock.pos;
          stroke.strokeStyle = {
            width: 10,
            cap: 'round',
            color: 0x000000,
            ...commandBlock.strokeStyle,
          };
          console.log(commandBlock.strokeStyle);

          const mode = checkBlendModes(commandBlock.blendMode);
          stroke.blendMode = mode;
          stroke.moveTo(pos.x, pos.y);
          stroke.lineTo(pos.x, pos.y - 0.01);
          stroke.stroke();
          layer.container.addChild(stroke);
          lastPos = new Point(pos.x, pos.y);
          break;
        }
        case 'line': {
          if (!commandBlock.pos) return;
          const pos = commandBlock.pos;
          const mid = {
            x: (pos.x + lastPos.x) * 0.5,
            y: (pos.y + lastPos.y) * 0.5,
          };

          stroke.quadraticCurveTo(lastPos.x, lastPos.y, mid.x, mid.y);
          stroke.stroke();
          lastPos = new Point(pos.x, pos.y);
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

  // redraw
  conn.db.layer.onUpdate(
    (_ctx: EventContext, _oldLayer: ServerLayer, newLayer: ServerLayer) => {
      if (
        !newLayer.forceUpdate ||
        !newLayer.base64 ||
        !identity ||
        newLayer.owner.isEqual(identity)
      )
        return;
      console.log(`Received update layer command`);
      const l = getOrCreateLayer(newLayer.id, newLayer.owner, board);
      let stroke = new Graphics();
      app.renderer.render({
        container: stroke,
        target: l.rt,
        clear: true,
      });
      stroke.destroy();
      drawImageFromBase64(app, newLayer.base64, l.rt);
    }
  );

  conn.db.layer.onInsert((_ctx: EventContext, layer: ServerLayer) => {
    console.log(`Received create layer command`);
    const l = createLayer(
      {
        id: layer.id,
        ownerId: layer.owner,
        ownerName: layer.owner.toHexString().slice(0, 8),
        title: layer.name || layer.owner.toHexString().slice(0, 8),
      },
      board
    );

    if (identity && layer.owner.isEqual(identity)) {
      activeLayer = l;
      ui.setActiveLayer(layer.id);
    }
  });

  conn.db.layer.onDelete((_ctx: EventContext, layer: ServerLayer) => {
    console.log(`Received delete layer command`);

    const l = layers.get(layer.id);
    l?.container.destroy();
    layers.delete(layer.id);
    ui.renderLayers(Array.from(layers.values()));
  });
};

const connect = () => {
  return new Promise<DbConnection>((res, rej) => {
    const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
      let count = 0;
      for (const query of queries) {
        conn
          ?.subscriptionBuilder()
          .onApplied(() => {
            count++;
            if (count === queries.length) {
              console.log('SDK client cache initialized.');
            }
          })
          .subscribe(query);
      }
    };

    const onConnect = (
      conn: DbConnection,
      userIdentity: Identity,
      token: string
    ) => {
      identity = userIdentity;
      localStorage.setItem('auth_token', token);
      console.log(
        'Connected to SpacetimeDB with identity:',
        identity.toHexString()
      );

      subscribeToQueries(conn, [
        'SELECT * FROM layer',
        'SELECT * FROM user',
        'SELECT * FROM command',
      ]);
      res(conn);
    };

    const onDisconnect = () => {
      // todo
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log('Error connecting to SpacetimeDB:', err);
      rej(err);
    };

    DbConnection.builder()
      .withUri('ws://localhost:3000')
      .withModuleName('drawamare')
      .withToken(localStorage.getItem('auth_token') || '')
      .onConnect(onConnect)
      .onDisconnect(onDisconnect)
      .onConnectError(onConnectError)
      .build();
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
  window.addEventListener('resize', () => {
    app.resize();
  });

  window.addEventListener('wheel', (e) => {
    scale(app, e.deltaY);
  });

  return { app, board };
};

const ui = new LayerUI();
const toolbarUi = new ToolbarUI();

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

const scale = (app: Application, delta: number) => {
  const y = delta > 0 ? -0.1 : 0.1;
  app.stage.scale = app.stage.scale.x + y;
  if (app.stage.scale.x < minScale) app.stage.scale = minScale; // Prevent inverting or too small scale
  if (app.stage.scale.x > maxScale) app.stage.scale = maxScale; // Prevent too big scale
};

(async () => {
  const conn = await connect();
  if (!conn.identity) throw new Error('User identity is not defined');
  const { app, board } = await init();
  initLayers(conn, app, board);

  ui.userId = conn.identity;
  ui.renderLayers(Array.from(layers.values()));
  ui.onSelectLayer((layerId) => {
    console.log(`Select layer ID: ${layerId}`);
    const l = getLayer(layerId);
    if (l) {
      activeLayer = l;
      ui.setActiveLayer(l.id);
    } else {
      ui.renderLayers(Array.from(layers.values()));
    }

    // History stack and redo stack should be cleared when a new layer is selected.
    historyStack = [];
    redoStack = [];
  });

  ui.onAddLayer(() => {
    console.log('Add new layer');
    conn.reducers.createLayer();
  });

  ui.onDeleteLayer((layerId) => {
    historyStack = [];
    redoStack = [];
    conn.reducers.deleteLayer(layerId);
  });

  socketEventHandler(conn, app, board);

  toolbarUi.onToolClick((tool) => {
    switch (tool) {
      case Tools.BRUSH: {
        isErasing = false;
        break;
      }
      case Tools.ERASER: {
        isErasing = true;
        break;
      }
      case Tools.DELETE: {
        if (!activeLayer) return;
        let stroke = new Graphics();
        app.renderer.render({
          container: stroke,
          target: activeLayer.rt,
          clear: true,
        });
        stroke.destroy();
        saveState();
        emitLayer(true);
        break;
      }
      case Tools.ZOOMIN: {
        scale(app, -1);
        break;
      }
      case Tools.ZOOMOUT: {
        scale(app, 1);
        break;
      }
      case Tools.DOWNLOAD: {
        let mask = board.mask;
        board.mask = null;
        app.renderer.extract.download(app.stage);
        board.mask = mask;
        break;
      }
      case Tools.UNDO: {
        undo();
        break;
      }
      case Tools.REDO: {
        redo();
        break;
      }
    }
  });

  toolbarUi.onColorChange((color) => {
    strokeStyle.color = Number(color.replace('#', '0x'));
  });

  // History stack and redo stack should be cleared when a new layer is selected.
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

  const emitLayer = (forceUpdate: boolean) => {
    if (!activeLayer) return;

    const layerId = activeLayer.id;
    app.renderer.extract
      .base64({
        format: 'png',
        target: activeLayer.rt,
      })
      .then((data) => {
        conn.reducers.saveLayer(layerId, data, forceUpdate);
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
  let lastCommands: DrawCommand[] = [];

  const offsetPosition = (x: number, y: number): Point => {
    const stageScale = app.stage.scale.x;
    const pos = new Point(x / stageScale, y / stageScale);
    return vSub(pos, board.position);
  };

  let lastPos: Point;
  const minDelta = 5;

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
      commandType: 'initLine',
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
    lastPos = pos;
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

    if (distance(pos, lastPos) < minDelta) return;

    const command: DrawCommand = {
      commandType: 'line',
      pos,
      blendMode: undefined,
      strokeStyle: undefined,
    };

    lastCommands.push(command);
    const mid = {
      x: (pos.x + lastPos.x) * 0.5,
      y: (pos.y + lastPos.y) * 0.5,
    };

    stroke.quadraticCurveTo(lastPos.x, lastPos.y, mid.x, mid.y);
    stroke.stroke();
    lastPos = pos;
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
        commandType: 'endLine',
        blendMode: undefined,
        strokeStyle: undefined,
        pos: undefined,
      };

      lastCommands.push(command);
      emitLayer(false);
      conn.reducers.sendCommand(activeLayer.id, lastCommands);
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

    const layerId = activeLayer.id;

    app.renderer.extract
      .base64({
        format: 'png',
        target: activeLayer.rt,
      })
      .then((data) => {
        conn.reducers.saveLayer(layerId, data, true);
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
      if (isErasing) {
        toolbarUi.setActiveTool(Tools.ERASER);
      } else {
        toolbarUi.setActiveTool(Tools.BRUSH);
      }
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
