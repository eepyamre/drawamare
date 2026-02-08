import { AppEvents, EventBus } from '../events';
import { IDomEventsController } from '../interfaces';
import { Tools } from '../utils';
import { Logger } from '../utils/logger';
import { DrawingController } from './DrawingController';
import { LayerController } from './LayerController';

export class DomEventsController implements IDomEventsController {
  static instance: DomEventsController;

  static getInstance(): IDomEventsController {
    if (!this.instance) {
      this.instance = new DomEventsController();
    }
    return this.instance;
  }

  constructor() {
    this._initEvents();
  }

  _initEvents() {
    Logger.debug(`[Keyboard] Initializing window events`);
    window.addEventListener('keydown', (e) => this._onKeyDown.call(this, e));
    window.addEventListener('keyup', (e) => this._onKeyUp.call(this, e));
  }

  _onKeyDown(e: KeyboardEvent) {
    Logger.debug(
      `[Keyboard] onKeyDown fired with the key: ${e.key.toLowerCase()}`
    );
    const bus = EventBus.getInstance();

    const key = e.key.toLowerCase();
    const keys = ['e', 'z', 'delete', '+', '-', ' '];
    if (keys.includes(key)) {
      e.preventDefault();
    }

    switch (key) {
      case 'e':
        if (!DrawingController.getInstance().isErasing) {
          bus.emit(AppEvents.DRAWING_SET_TOOL, Tools.ERASER);
        } else {
          bus.emit(AppEvents.DRAWING_SET_TOOL, Tools.BRUSH);
        }
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            bus.emit(AppEvents.HISTORY_REDO, null);
          } else {
            bus.emit(AppEvents.HISTORY_UNDO, null);
          }
        }
        break;
      case 'delete':
        bus.emit(
          AppEvents.LAYER_CLEAR_ACTIVE,
          LayerController.getInstance().activeLayer
        );
        break;
      case '+':
        bus.emit(AppEvents.CANVAS_ZOOM_IN, null);
        break;
      case '-':
        bus.emit(AppEvents.CANVAS_ZOOM_OUT, null);
        break;
      case ' ':
        bus.emit(AppEvents.CANVAS_SET_PAN_MODE, true);
        break;
    }
  }

  _onKeyUp(e: KeyboardEvent) {
    Logger.debug(
      `[Keyboard] onKeyUp fired with the key: ${e.key.toLowerCase()}`
    );
    const bus = EventBus.getInstance();

    const key = e.key.toLowerCase();
    const keys = ['e', 'z', 'delete', '+', '-', ' '];
    if (keys.includes(key)) {
      e.preventDefault();
    }

    switch (key) {
      case ' ':
        bus.emit(AppEvents.CANVAS_SET_PAN_MODE, false);
        break;
    }
  }
}
