import {
  BrushController,
  DrawingController,
  HistoryController,
  LayerController,
  NetworkController,
  PixiController,
} from './controllers/';
import { DomEventsController } from './controllers/DomEventsController';
import { AppEvents, EventBus } from './events';
import { BrushEditorUI, BrushSettingsUI, LayerUI, ToolbarUI } from './ui/';
import { wait } from './utils';
import { Logger } from './utils/logger';

const startApp = async () => {
  if (!('chrome' in window)) {
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
  let waitTime = 5000;
  while (!connected) {
    try {
      await networkCtr.connect();
      connected = true;
    } catch (_e) {
      waitTime = waitTime + 5000;
      Logger.info(
        `[Network] Trying to reconnect in ${Math.round(waitTime / 1000)} seconds...`
      );
      await wait(waitTime);
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
  DrawingController.getInstance();
  DomEventsController.getInstance();
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

  {
    // TODO: REFACTOR
    layerUI.userId = networkCtr.getIdentity()!;
    layerUI.renderLayers(layerCtr.getAllLayers());
    layerUI.onSelectLayer((layerId) => {
      Logger.debug(`[Layer UI] Select layer ID: ${layerId}`);
      bus.emit(AppEvents.LAYER_SELECT, layerId);
      layerUI.setActiveLayer(layerId);
    });

    layerUI.onAddLayer(() => {
      Logger.debug('[Layer UI] Add new layer');
      bus.emit(AppEvents.NETWORK_CREATE_LAYER, null);
    });

    layerUI.onDeleteLayer((layerId) => {
      Logger.debug(`[Layer UI] Delete layer ${layerId}`);
      bus.emit(AppEvents.LAYER_DELETE, layerId);
      bus.emit(AppEvents.HISTORY_CLEAR_REDO, null);
      bus.emit(AppEvents.HISTORY_CLEAR_UNDO, null);
      bus.emit(AppEvents.NETWORK_DELETE_LAYER, layerId);
    });
  }
};

startApp();
