import { Layer } from '../interfaces';
import { DrawCommand } from '../module_bindings';
import { PressureSettings } from '../ui';
import { Brush, BrushWithPreview, Tools } from '../utils';

export enum AppEvents {
  LAYERS_RERENDER = 'layers:rerender',
  LAYER_ACTIVATED = 'layer:activated',
  LAYER_CLEAR_ACTIVE = 'layer:clearActive',
  BRUSH_EDITOR_SAVE = 'brushEditor:save',
  BRUSH_EDITOR_CANCEL = 'brushEditor:cancel',
  BRUSH_COLOR_CHANGE = 'brush:colorChange',
  BRUSH_SIZE_CHANGE = 'brush:sizeChange',
  BRUSH_OPACITY_CHANGE = 'brush:opacityChange',
  BRUSH_PRESSUTE_TOGGLE = 'brush:pressureToggle',
  BRUSH_CHANGE = 'brush:change',
  BRUSH_EDIT = 'brush:edit',
  DRAWING_SET_TOOL = 'drawing:setTool',
  CANVAS_ZOOM_IN = 'canvas:zoomIn',
  CANVAS_ZOOM_OUT = 'canvas:zoomOut',
  CANVAS_DOWNLOAD = 'canvas:download',
  CANVAS_SET_PAN_MODE = 'canvas:setPanMode',
  HISTORY_UNDO = 'history:undo',
  HISTORY_REDO = 'history:redo',
  NETWORK_DRAW_COMMANDS = 'network:drawCommandsRequest',
  NETWORK_CREATE_LAYER = 'network:createLayerRequest',
  NETWORK_DELETE_LAYER = 'network:deleteLayerRequest',
  NETWORK_SAVE_LAYER = 'network:saveLayerRequest',
}

export type EventData = {
  [AppEvents.LAYERS_RERENDER]: Layer[];
  [AppEvents.LAYER_ACTIVATED]: number;
  [AppEvents.LAYER_CLEAR_ACTIVE]: null;
  [AppEvents.BRUSH_EDITOR_SAVE]: {
    brush: BrushWithPreview;
    editingIndex: number | null;
  };
  [AppEvents.BRUSH_EDITOR_CANCEL]: null;
  [AppEvents.BRUSH_SIZE_CHANGE]: number;
  [AppEvents.BRUSH_OPACITY_CHANGE]: number;
  [AppEvents.BRUSH_PRESSUTE_TOGGLE]: PressureSettings;
  [AppEvents.BRUSH_CHANGE]: Brush;
  [AppEvents.BRUSH_EDIT]: { brush: BrushWithPreview; index: number };
  [AppEvents.DRAWING_SET_TOOL]: Tools.BRUSH | Tools.ERASER;
  [AppEvents.CANVAS_ZOOM_IN]: null;
  [AppEvents.CANVAS_ZOOM_OUT]: null;
  [AppEvents.CANVAS_DOWNLOAD]: null;
  [AppEvents.HISTORY_UNDO]: null;
  [AppEvents.HISTORY_REDO]: null;
  [AppEvents.BRUSH_COLOR_CHANGE]: string;
  [AppEvents.CANVAS_SET_PAN_MODE]: boolean;
  [AppEvents.NETWORK_CREATE_LAYER]: null;
  [AppEvents.NETWORK_DRAW_COMMANDS]: {
    layerId: number;
    commands: DrawCommand[];
  };
  [AppEvents.NETWORK_DELETE_LAYER]: number;
  [AppEvents.NETWORK_SAVE_LAYER]: {
    layerId: number;
    base64: string;
    forceUpdate: boolean;
  };
};
