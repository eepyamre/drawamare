import { v4 as uuidv4 } from 'uuid';
import { useEffect, useCallback, useRef, useContext } from 'preact/hooks';
import { LayerMenu } from '@/components';
import { Layer } from '@/state';
import { LayersState } from '@/index';
import { effect } from '@preact/signals';
import css from './styles.module.scss';

export const Home = () => {
  const { layers, activeLayerId } = useContext(LayersState);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const createLayer = (name: string): Layer => {
    const canvas = document.createElement('canvas');
    canvas.classList.add(css.drawingCanvas);
    canvasAreaRef.current?.append(canvas);

    return {
      id: uuidv4(),
      name: name,
      canvasEl: canvas,
      context: null,
      historyStack: [],
      historyIndex: 0,
    };
  };

  const setActiveLayerIdWrapper = (layerId: string) => {
    activeLayerId.value = layerId;
    layers.value.forEach((layer) => {
      if (layer.id === layerId) {
        layer.canvasEl.classList.add(css.active);
      } else {
        layer.canvasEl.classList.remove(css.active);
      }
    });
  };

  const getCurrentLayer = () => {
    return layers.value.find((l) => l.id === activeLayerId.value);
  };

  const saveToHistory = () => {
    const layer = getCurrentLayer();
    const canvas = layer.canvasEl;
    const ctx = layer.context;

    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    layers.value.forEach((l) => {
      if (l.id === layer.id) {
        const newStack = [
          ...l.historyStack.slice(0, l.historyIndex + 1),
          imageData,
        ];
        l.historyIndex += 1;
        l.historyStack = newStack;
      }
    });
  };

  const redrawFromHistory = (_layer: Layer, index?: number) => {
    const layer = _layer ?? getCurrentLayer();
    const canvas = layer.canvasEl;
    const ctx = layer.context;
    if (!canvas || !ctx) return;

    if (layer.historyStack.length > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const imageData = layer.historyStack[layer.historyIndex];
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    }
  };

  const undo = () => {
    const currentLayer = getCurrentLayer();
    if (!currentLayer) return;
    if (currentLayer.historyIndex > 0) {
      layers.value.forEach((l) => {
        if (l.id === currentLayer.id) {
          l.historyIndex -= 1;
          redrawFromHistory(l, l.historyIndex);
        }
      });
    } else {
      console.log('No more undo steps available for layer', currentLayer.name);
    }
  };

  const redo = () => {
    const currentLayer = getCurrentLayer();
    if (!currentLayer) return;
    if (currentLayer.historyIndex < currentLayer.historyStack.length - 1) {
      layers.value.forEach((l) => {
        if (l.id === currentLayer.id) {
          l.historyIndex += 1;
          redrawFromHistory(l, l.historyIndex);
        }
      });
    } else {
      console.log('No more redo steps available for layer', currentLayer.name);
    }
  };

  const handleLayerSelect = useCallback((layerId: string) => {
    setActiveLayerIdWrapper(layerId);
    console.log(`Layer selected: ${layerId}`);
  }, []);

  const handleAddLayer = useCallback(() => {
    const newLayer = createLayer(`Layer ${layers.value.length + 1}`);
    initCanvas(newLayer);
    layers.value.push(newLayer);
    setActiveLayerIdWrapper(newLayer.id);
    console.log('Layer added');
  }, [layers]);

  const initCanvas = (layer: Layer) => {
    const canvas = layer.canvasEl;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    layer.context = ctx;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = cssWidth * pixelRatio;
    canvas.height = cssHeight * pixelRatio;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.scale(pixelRatio, pixelRatio);

    if (layer.historyStack.length === 0) {
      saveToHistory();
    }

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e: MouseEvent) => {
      if (activeLayerId.value !== layer.id) return;
      isDrawing = true;
      [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    const draw = (e: MouseEvent) => {
      if (activeLayerId.value !== layer.id) return;
      if (!isDrawing) return;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    const endDrawing = () => {
      if (activeLayerId.value !== layer.id) return;
      isDrawing = false;
      saveToHistory();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeLayerId.value !== layer.id) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDrawing);
    canvas.addEventListener('mouseout', endDrawing);
    window.addEventListener('keydown', handleKeyDown);
  };

  useEffect(() => {
    const layer = createLayer('Layer 1');
    layers.value.push(layer);
    setActiveLayerIdWrapper(layer.id);
    initCanvas(layer);
    console.log('Initial layer created');
  }, []);

  return (
    <div class={css.homeContainer}>
      <div class={css.canvasArea} ref={canvasAreaRef}></div>
      <LayerMenu
        layers={layers.value.map((l) => ({ id: l.id, name: l.name }))}
        activeLayerId={activeLayerId.value}
        onLayerSelect={handleLayerSelect}
        onAddLayer={handleAddLayer}
      />
    </div>
  );
};
