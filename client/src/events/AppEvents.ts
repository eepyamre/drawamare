import { Layer } from '../interfaces';
import { BrushWithPreview } from '../utils';

export enum AppEvents {
  LAYERS_RERENDER = 'layers:rerender',
  LAYER_ACTIVATED = 'layer:activated',
  BRUSH_EDITOR_SAVE = 'brushEditor:save',
  BRUSH_EDITOR_CANCEL = 'brushEditor:cancel',
}

export type EventData = {
  [AppEvents.LAYERS_RERENDER]: Layer[];
  [AppEvents.LAYER_ACTIVATED]: number;
  [AppEvents.BRUSH_EDITOR_SAVE]: {
    brush: BrushWithPreview;
    editingIndex: number | null;
  };
  [AppEvents.BRUSH_EDITOR_CANCEL]: null;
};
