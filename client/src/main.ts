import {
  BrushController,
  DrawingController,
  HistoryController,
  LayerController,
  NetworkController,
  PixiController,
} from './controllers/';
import { AppEvents, EventBus } from './events';
import { BrushEditorUI, BrushSettingsUI, LayerUI, ToolbarUI } from './ui/';
import { Tools, wait } from './utils';

const startApp = async () => {
  // eslint-disable-next-line
  if (!(window as any).chrome) {
    alert(
      'This app is currently supported only in Chrome. See the console for more details.'
    );
    console.error(
      'Due to a known issue in pixi.js(https://github.com/pixijs/pixijs/issues/11378), only Chrome is supported at this time.'
    );

    return;
  }
  const networkCtr = new NetworkController();
  let connected = false;
  while (!connected) {
    try {
      await networkCtr.connect();
      connected = true;
      // eslint-disable-next-line
    } catch (e) {
      console.log('Trying to reconnect in 5 seconds...');
      await wait(5000);
    }
  }
  if (!networkCtr.getIdentity())
    throw new Error('User identity is not defined');

  const pixiCtr = new PixiController();
  await pixiCtr.init();
  const layerUI = new LayerUI();
  const layerCtr = new LayerController();
  layerCtr.init(networkCtr, pixiCtr);

  const brushUI = new BrushSettingsUI();
  const brushCtr = new BrushController();
  new ToolbarUI();

  const brushEditorUI = new BrushEditorUI();

  await brushEditorUI.initPixi();
  const historyCtr = new HistoryController();
  const drawingCtr = new DrawingController(
    pixiCtr,
    layerCtr,
    historyCtr,
    brushUI,
    brushCtr
  );
  networkCtr.initEventListeners(pixiCtr, layerCtr, drawingCtr, brushCtr);

  const bus = EventBus.getInstance();

  const clearLayer = () => {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;
    pixiCtr.clearRenderTarget(activeLayer.rt);
    historyCtr.saveState(pixiCtr, activeLayer);
    pixiCtr.extractBase64(activeLayer.rt).then((data) => {
      bus.emit(AppEvents.NETWORK_SAVE_LAYER, {
        layerId: activeLayer.id,
        base64: data,
        forceUpdate: true,
      });
    });
  };

  {
    // TODO: REFACTOR
    bus.on(AppEvents.LAYER_CLEAR_ACTIVE, clearLayer);
    bus.on(AppEvents.HISTORY_UNDO, () => historyCtr.undo(pixiCtr, layerCtr));
    bus.on(AppEvents.HISTORY_REDO, () => historyCtr.redo(pixiCtr, layerCtr));
  }

  // TODO: move to keyboard/event controller
  {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const keys = ['e', 'z', 'delete', '+', '-', ' '];
      if (keys.includes(key)) {
        e.preventDefault();
      }

      switch (key) {
        case 'e':
          if (!drawingCtr.isErasing) {
            bus.emit(AppEvents.DRAWING_SET_TOOL, Tools.ERASER);
          } else {
            bus.emit(AppEvents.DRAWING_SET_TOOL, Tools.BRUSH);
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              bus.emit(AppEvents.HISTORY_REDO, null);
            } else {
              bus.emit(AppEvents.HISTORY_UNDO, null);
            }
          }
          break;
        case 'delete':
          bus.emit(AppEvents.LAYER_CLEAR_ACTIVE, null);
          break;
        case '+':
          bus.emit(AppEvents.CANVAS_ZOOM_IN, null);
          break;
        case '-':
          bus.emit(AppEvents.CANVAS_ZOOM_OUT, null);
          break;
        case ' ':
          bus.emit(AppEvents.CANVAS_SET_PAN_MODE, true);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      const keys = ['e', 'z', 'delete', '+', '-', ' '];
      if (keys.includes(key)) {
        e.preventDefault();
      }

      switch (key) {
        case ' ':
          bus.emit(AppEvents.CANVAS_SET_PAN_MODE, false);
          break;
      }
    });
  }

  {
    layerUI.userId = networkCtr.getIdentity()!;
    layerUI.renderLayers(layerCtr.getAllLayers());
    layerUI.onSelectLayer((layerId) => {
      console.log(`Select layer ID: ${layerId}`);
      layerCtr.setActiveLayer(layerId);
      layerUI.setActiveLayer(layerId);
    });

    layerUI.onAddLayer(() => {
      console.log('Add new layer');
      bus.emit(AppEvents.NETWORK_CREATE_LAYER, null);
    });

    layerUI.onDeleteLayer((layerId) => {
      console.log(`Delete layer ${layerId}`);
      layerCtr.deleteLayer(layerId);
      historyCtr.clearHistory();
      historyCtr.clearRedo();
      bus.emit(AppEvents.NETWORK_DELETE_LAYER, layerId);
    });
  }
};

startApp();
