import { Layer } from '../interfaces';

export enum AppEvents {
  LAYERS_RERENDER = 'layers:rerender',
  LAYER_ACTIVATED = 'layer:activated',
}

export type EventData = {
  [AppEvents.LAYERS_RERENDER]: Layer[];
  [AppEvents.LAYER_ACTIVATED]: number;
};
