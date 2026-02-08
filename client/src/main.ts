import {
  BrushController,
  DrawingController,
  HistoryController,
  LayerController,
  NetworkController,
  PixiController,
} from './controllers/';
import { DomEventsController } from './controllers/DomEventsController';
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
  if (!NetworkController.identity) {
    throw new Error('User identity is not defined');
  }

  const pixiCtr = PixiController.getInstance();
  await pixiCtr.init();
  new LayerUI(NetworkController.identity);
  LayerController.getInstance();

  BrushSettingsUI.getInstance();
  BrushController.getInstance();
  new ToolbarUI();

  const brushEditorUI = new BrushEditorUI();

  await brushEditorUI.initPixi();
  HistoryController.getInstance();
  DrawingController.getInstance();
  DomEventsController.getInstance();
  networkCtr.initEventListeners();
};

startApp();
