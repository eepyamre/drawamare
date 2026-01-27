import { Identity } from 'spacetimedb';

import { AppEvents, EventBus } from '../events';
import { Layer } from '../interfaces';

type LayerSelectCallback = (layerId: number) => void;
type AddLayerCallback = () => void;
type DeleteLayerCallback = (layerId: number) => void;

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

    this.initBusListeners();
  }

  initBusListeners() {
    const bus = EventBus.getInstance();
    bus.on(AppEvents.LAYERS_RERENDER, this.renderLayers.bind(this));
    bus.on(AppEvents.LAYER_ACTIVATED, this.setActiveLayer.bind(this));
  }

  public onSelectLayer(callback: LayerSelectCallback) {
    this.onSelectLayerCallback = callback;
  }

  public onAddLayer(callback: AddLayerCallback) {
    this.onAddLayerCallback = callback;
  }

  public onDeleteLayer(callback: DeleteLayerCallback) {
    this.onDeleteLayerCallback = callback;
  }

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

  public set userId(value: Identity) {
    this._userId = value;
  }
}
