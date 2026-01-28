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
  const networkCtr = NetworkController.getInstance();
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
  if (!networkCtr.getIdentity()) {
    throw new Error('User identity is not defined');
  }

  const pixiCtr = PixiController.getInstance();
  await pixiCtr.init();
  const layerCtr = LayerController.getInstance();
  const layerUI = new LayerUI();

  BrushSettingsUI.getInstance();
  BrushController.getInstance();
  new ToolbarUI();

  const brushEditorUI = new BrushEditorUI();

  await brushEditorUI.initPixi();
  HistoryController.getInstance();
  const drawingCtr = DrawingController.getInstance();
  networkCtr.initEventListeners();

  const bus = EventBus.getInstance();

  const clearLayer = () => {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;
    pixiCtr.clearRenderTarget(activeLayer.rt);
    bus.emit(AppEvents.HISTORY_SAVE_STATE, activeLayer);
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
      bus.emit(AppEvents.LAYER_SELECT, layerId);
      layerUI.setActiveLayer(layerId);
    });

    layerUI.onAddLayer(() => {
      console.log('Add new layer');
      bus.emit(AppEvents.NETWORK_CREATE_LAYER, null);
    });

    layerUI.onDeleteLayer((layerId) => {
      console.log(`Delete layer ${layerId}`);
      bus.emit(AppEvents.LAYER_DELETE, layerId);
      bus.emit(AppEvents.HISTORY_CLEAR_REDO, null);
      bus.emit(AppEvents.HISTORY_CLEAR_UNDO, null);
      bus.emit(AppEvents.NETWORK_DELETE_LAYER, layerId);
    });
  }
};

startApp();
