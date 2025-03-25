import { Layer } from './utils';

type LayerSelectCallback = (layerId: string) => void;
type AddLayerCallback = () => void;

/**
 * LayerUI class manages the UI for selecting and adding layers.
 */
export class LayerUI {
  private layerListElement: HTMLElement;
  private addLayerButton: HTMLElement;
  private onSelectLayerCallback: LayerSelectCallback | null = null;
  private onAddLayerCallback: AddLayerCallback | null = null;
  private _userId: string | null = null;

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
      layerItem.dataset.layerId = layer.id;
      layerItem.dataset.ownerId = layer.ownerId;

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

      if (this._userId === layer.ownerId) {
        layerItem.classList.add('owned');

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
  public setActiveLayer(layerId: string) {
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
  public set userId(value: string) {
    this._userId = value;
  }
}
