import { BrushController } from './controllers/brush';
import { BrushEngine } from './controllers/brushEngine';
import { DrawingController } from './controllers/drawing';
import { HistoryController } from './controllers/history';
import { LayerController } from './controllers/layer';
import { NetworkController } from './controllers/network';
import { PixiController } from './controllers/pixi';
import { BrushSettingsUI, LayerUI, ToolbarUI, Tools } from './controllers/ui';
import { wait } from './utils';

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
  const layerCtr = new LayerController(layerUI);
  layerCtr.init(networkCtr, pixiCtr);

  const brushUI = new BrushSettingsUI();
  const brushCtr = new BrushController();
  const brushEngine = new BrushEngine('.brush-editor', brushCtr, brushUI);
  const toolbarUI = new ToolbarUI();
  const historyCtr = new HistoryController();
  const drawingCtr = new DrawingController(
    pixiCtr,
    layerCtr,
    historyCtr,
    networkCtr,
    brushUI,
    brushCtr
  );
  networkCtr.initEventListeners(pixiCtr, layerCtr, drawingCtr, brushCtr);

  const clearLayer = () => {
    const activeLayer = layerCtr.getActiveLayer();
    if (!activeLayer) return;
    pixiCtr.clearRenderTarget(activeLayer.rt);
    historyCtr.saveState(pixiCtr, activeLayer);
    pixiCtr.extractBase64(activeLayer.rt).then((data) => {
      networkCtr.emitSaveLayerRequest(activeLayer.id, data, true);
    });
  };

  // TOOLBAR INIT
  {
    toolbarUI.onToolClick((tool) => {
      switch (tool) {
        case Tools.BRUSH:
        case Tools.ERASER: {
          drawingCtr.setDrawingTool(tool);
          break;
        }
        case Tools.DELETE: {
          clearLayer();
          break;
        }
        case Tools.ZOOMIN: {
          pixiCtr.scale(-1);
          break;
        }
        case Tools.ZOOMOUT: {
          pixiCtr.scale(1);
          break;
        }
        case Tools.DOWNLOAD: {
          pixiCtr.download();
          break;
        }
        case Tools.UNDO: {
          historyCtr.undo(pixiCtr, layerCtr, networkCtr);
          break;
        }
        case Tools.REDO: {
          historyCtr.redo(pixiCtr, layerCtr, networkCtr);
          break;
        }
      }
    });

    toolbarUI.onColorChange((color) => {
      drawingCtr.setCurrentColor(color);
    });

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const keys = ['e', 'z', 'delete', '+', '-', ' '];
      if (keys.includes(key)) {
        e.preventDefault();
      }

      switch (key) {
        case 'e':
          if (drawingCtr.toggleEraser()) {
            toolbarUI.setActiveTool(Tools.ERASER);
          } else {
            toolbarUI.setActiveTool(Tools.BRUSH);
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              historyCtr.redo(pixiCtr, layerCtr, networkCtr);
            } else {
              historyCtr.undo(pixiCtr, layerCtr, networkCtr);
            }
          }
          break;
        case 'delete':
          clearLayer();
          break;
        case '+':
          pixiCtr.scale(-1);
          break;
        case '-':
          pixiCtr.scale(+1);
          break;
        case ' ':
          drawingCtr.setPanMode(true);
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
          drawingCtr.setPanMode(false);
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
      networkCtr.emitCreateLayerRequest();
    });

    layerUI.onDeleteLayer((layerId) => {
      console.log(`Delete layer ${layerId}`);
      layerCtr.deleteLayer(layerId);
      historyCtr.clearHistory();
      historyCtr.clearRedo();
      networkCtr.emitDeleteLayerRequest(layerId);
    });
  }

  // BRUSH SETTINGS

  brushUI.onSizeChange((size) => {
    drawingCtr.setSize(size);
    pixiCtr.setMouseSize(size);
  });
  brushUI.onOpacityChange((opacity) => {
    drawingCtr.setOpacity(opacity);
  });
  brushUI.onPressureToggle((settings) => {
    drawingCtr.setPressureSettings(settings);
  });
  brushUI.onBrushChange((brush) => {
    brushCtr.setBrush(brush);
  });
  brushUI.onEditBrush((brush, index) => {
    brushEngine.loadBrush(brush, index);
  });
};

startApp();
