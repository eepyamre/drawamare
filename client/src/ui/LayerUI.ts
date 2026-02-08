import { Identity } from 'spacetimedb';

import { AppEvents, EventBus } from '../events';
import { Layer } from '../interfaces';
import { Logger } from '../utils/logger';

export class LayerUI {
  private layerListElement: HTMLElement;
  private addLayerButton: HTMLElement;
  private _userId: Identity | undefined;

  constructor(userId: Identity) {
    this._userId = userId;
    this.layerListElement = document.querySelector('.layer-list')!;
    this.addLayerButton = document.querySelector('.add-layer-button')!;

    this.addLayerButton.addEventListener('click', () => {
      Logger.debug('[Layer UI] Add new layer');
      EventBus.getInstance().emit(AppEvents.NETWORK_CREATE_LAYER, null);
    });

    this.initBusListeners();
  }

  initBusListeners() {
    const bus = EventBus.getInstance();
    bus.on(AppEvents.LAYERS_RERENDER, this.renderLayers.bind(this));
    bus.on(AppEvents.LAYER_ACTIVATED, this.setActiveLayer.bind(this));
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
          Logger.debug(`[Layer UI] Delete layer ${layer.id}`);
          const bus = EventBus.getInstance();
          bus.emit(AppEvents.HISTORY_CLEAR_REDO, null);
          bus.emit(AppEvents.HISTORY_CLEAR_UNDO, null);
          bus.emit(AppEvents.NETWORK_DELETE_LAYER, layer.id);
          bus.emit(AppEvents.LAYER_DELETE, layer.id);
        });

        layerItem.addEventListener('click', () => {
          Logger.debug(`[Layer UI] Select layer ID: ${layer.id}`);
          EventBus.getInstance().emit(AppEvents.LAYER_SELECT, layer.id);
          this.setActiveLayer(layer.id);
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
}
