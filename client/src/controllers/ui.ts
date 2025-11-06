import { Identity } from 'spacetimedb';
import { Layer } from '../utils';

type LayerSelectCallback = (layerId: number) => void;
type AddLayerCallback = () => void;
type DeleteLayerCallback = (layerId: number) => void;

/**
 * LayerUI class manages the UI for selecting and adding layers.
 */
export class LayerUI {
  private layerListElement: HTMLElement;
  private addLayerButton: HTMLElement;
  private onSelectLayerCallback: LayerSelectCallback | null = null;
  private onAddLayerCallback: AddLayerCallback | null = null;
  private onDeleteLayerCallback: DeleteLayerCallback | null = null;
  private _userId: Identity | undefined;

  constructor() {
    this.layerListElement = document.querySelector('.layer-list')!;
    this.addLayerButton = document.querySelector('.add-layer-button')!;

    this.addLayerButton.addEventListener('click', () => {
      if (this.onAddLayerCallback) {
        this.onAddLayerCallback();
      }
    });
  }

  /**
   *
   * @param callback The callback to be called when a layer is selected.
   * @description set the onSelectLayerCallback property.
   */
  public onSelectLayer(callback: LayerSelectCallback) {
    this.onSelectLayerCallback = callback;
  }

  /**
   *
   * @param callback The callback to be called when a layer is selected.
   * @description set the onAddLayerCallback property.
   */
  public onAddLayer(callback: AddLayerCallback) {
    this.onAddLayerCallback = callback;
  }

  public onDeleteLayer(callback: DeleteLayerCallback) {
    this.onDeleteLayerCallback = callback;
  }

  /**
   *
   * @param layers The layers to render. Each layer should have an 'id', 'container', and 'rt'.
   * @description render the layers in the UI.
   * @returns void
   */
  public renderLayers(layers: Layer[]) {
    this.layerListElement.innerHTML = ''; // Clear existing layers

    layers.forEach((layer) => {
      const layerItem = document.createElement('div');
      layerItem.classList.add('layer-item');
      layerItem.dataset.layerId = String(layer.id);
      layerItem.dataset.ownerId = layer.ownerId.toHexString();

      const layerPreview = document.createElement('div');
      layerPreview.classList.add('layer-preview');

      const layerInfo = document.createElement('div');
      layerInfo.classList.add('layer-info');

      const layerName = document.createElement('span');
      layerName.classList.add('layer-name');
      layerName.textContent = layer.title;

      const layerOwner = document.createElement('span');
      layerOwner.classList.add('layer-owner');
      layerOwner.textContent = layer.ownerName;

      layerInfo.appendChild(layerName);
      layerInfo.appendChild(layerOwner);

      layerItem.appendChild(layerPreview);
      layerItem.appendChild(layerInfo);

      if (this._userId?.isEqual(layer.ownerId)) {
        layerItem.classList.add('owned');

        const layerDeleteBtn = document.createElement('img');
        layerDeleteBtn.classList.add('layer-delete');
        layerDeleteBtn.src = '/assets/icons/delete.svg';

        layerItem.appendChild(layerDeleteBtn);

        layerDeleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onDeleteLayerCallback) {
            this.onDeleteLayerCallback(layer.id);
          }
        });

        layerItem.addEventListener('click', () => {
          if (this.onSelectLayerCallback) {
            this.onSelectLayerCallback(layer.id);
          }
        });
      }

      this.layerListElement.appendChild(layerItem);
    });
  }

  /**
   *
   * @param layerId The ID of the layer to set as active.
   * @returns void
   * @description Sets the specified layer as active in the UI. It removes the 'active' class from all layers and adds it to the selected layer. This is useful for visualizing which layer is currently being edited or viewed.
   */
  public setActiveLayer(layerId: number) {
    // Remove active class from all layers
    this.layerListElement
      .querySelectorAll('.layer-item')
      .forEach((item) => item.classList.remove('active'));

    // Add active class to the selected layer
    const activeLayerItem = this.layerListElement.querySelector(
      `.layer-item[data-layer-id="${layerId}"]`
    );

    if (activeLayerItem) {
      activeLayerItem.classList.add('active');
    }
  }

  /**
   * Sets the user ID for filtering layers.
   * @param value The user ID.
   */
  public set userId(value: Identity) {
    this._userId = value;
  }
}

export enum Tools {
  BRUSH = 'brush',
  ERASER = 'eraser',
  DELETE = 'delete',
  ZOOMIN = 'zoomin',
  ZOOMOUT = 'zoomout',
  DOWNLOAD = 'download',
  UNDO = 'undo',
  REDO = 'redo',
  COLOR = 'color',
}

export class ToolbarUI {
  private tools: NodeListOf<HTMLElement>;
  private activeTool: Tools = Tools.BRUSH;
  private colorInput: HTMLInputElement;
  private onToolClickCallback: null | ((tool: Tools) => void);
  private onColorChangeCallback: null | ((value: string) => void);

  constructor() {
    this.tools = document.querySelectorAll('.tool');
    this.colorInput = document.querySelector(
      '.tool-color input[type="color"]'
    )!;
    this.onToolClickCallback = null;
    this.onColorChangeCallback = null;

    this.initializeTools();
    this.initializeColorPicker();
  }

  private initializeTools() {
    this.colorInput.value = '#000000';
    this.tools.forEach((tool) => {
      tool.addEventListener('click', () => {
        if (!this.onToolClickCallback) return;
        const toolType = tool.dataset.tool as Tools;
        if (!toolType) return;

        if (toolType === Tools.COLOR) {
          return;
        }
        this.onToolClickCallback(toolType);
        this.setActiveTool(toolType);
      });
    });

    this.setActiveTool(Tools.BRUSH);
  }

  private initializeColorPicker() {
    this.colorInput.addEventListener('input', (e) => {
      if (!this.onColorChangeCallback) return;
      const newColor = (e.target as HTMLInputElement).value;
      this.onColorChangeCallback(newColor);
    });
  }

  public setActiveTool(toolType: Tools) {
    if (toolType !== Tools.BRUSH && toolType !== Tools.ERASER) return;
    this.tools.forEach((tool) => tool.classList.remove('active'));

    const activeTool = Array.from(this.tools).find(
      (t) => t.dataset.tool === toolType
    );
    if (activeTool) {
      activeTool.classList.add('active');
      this.activeTool = toolType;
    }
  }

  public getSelectedTool(): Tools {
    return this.activeTool;
  }

  public getSelectedColor(): string {
    return this.colorInput.value;
  }

  public onToolClick(callback: typeof this.onToolClickCallback) {
    this.onToolClickCallback = callback;
  }

  public onColorChange(callback: typeof this.onColorChangeCallback) {
    this.onColorChangeCallback = callback;
  }
}

export type PressureSettings = {
  size: boolean;
  opacity: boolean;
};

export class BrushSettingsUI {
  private sizeSlider: HTMLInputElement;
  private opacitySlider: HTMLInputElement;
  private pressureSizeCheckbox: HTMLInputElement;
  private pressureOpacityCheckbox: HTMLInputElement;
  private brushItems: NodeListOf<HTMLButtonElement>;
  private activeBrush: string;

  private onSizeChangeCallback: ((size: number) => void) | null = null;
  private onOpacityChangeCallback: ((opacity: number) => void) | null = null;
  private onPressureToggleCallback:
    | ((settings: PressureSettings) => void)
    | null = null;
  private onBrushChangeCallback: ((brush: string) => void) | null = null;

  constructor() {
    this.sizeSlider = document.querySelector<HTMLInputElement>('#brush-size')!;
    this.opacitySlider =
      document.querySelector<HTMLInputElement>('#brush-opacity')!;
    this.pressureSizeCheckbox =
      document.querySelector<HTMLInputElement>('#pressure-size')!;
    this.pressureOpacityCheckbox =
      document.querySelector<HTMLInputElement>('#pressure-opacity')!;
    this.brushItems = document.querySelectorAll('.brush-item');

    const initialActiveBrush = document.querySelector('.brush-item.active');
    this.activeBrush = initialActiveBrush?.getAttribute('title') || 'Round';

    this.initEventListeners();
  }

  private initEventListeners() {
    this.sizeSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.onSizeChangeCallback?.(value);
    });

    this.opacitySlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.onOpacityChangeCallback?.(value);
    });

    const handlePressureChange = () => {
      this.onPressureToggleCallback?.({
        size: this.pressureSizeCheckbox.checked,
        opacity: this.pressureOpacityCheckbox.checked,
      });
    };

    this.pressureSizeCheckbox.addEventListener('change', handlePressureChange);
    this.pressureOpacityCheckbox.addEventListener(
      'change',
      handlePressureChange
    );

    this.brushItems.forEach((button) => {
      button.addEventListener('click', () => {
        const brushName = button.getAttribute('title');
        if (brushName) {
          this.setActiveBrush(brushName);
          this.onBrushChangeCallback?.(brushName);
        }
      });
    });
  }

  public onSizeChange(callback: (size: number) => void) {
    this.onSizeChangeCallback = callback;
  }

  public onOpacityChange(callback: (opacity: number) => void) {
    this.onOpacityChangeCallback = callback;
  }

  public onPressureToggle(callback: (settings: PressureSettings) => void) {
    this.onPressureToggleCallback = callback;
  }

  public onBrushChange(callback: (brush: string) => void) {
    this.onBrushChangeCallback = callback;
  }

  public setActiveBrush(brushName: string) {
    this.brushItems.forEach((button) => {
      if (button.getAttribute('title') === brushName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    this.activeBrush = brushName;
  }

  public getBrushSize = (): number => parseFloat(this.sizeSlider.value);
  public getBrushOpacity = (): number => parseFloat(this.opacitySlider.value);
  public getPressureSettings = (): PressureSettings => ({
    size: this.pressureSizeCheckbox.checked,
    opacity: this.pressureOpacityCheckbox.checked,
  });
  public getActiveBrush = (): string => this.activeBrush;
}
