import { LayerController } from '../controllers';
import { AppEvents, EventBus } from '../events';
import { Tools } from '../utils';

export class ToolbarUI {
  private tools: NodeListOf<HTMLElement>;
  private activeTool: Tools = Tools.BRUSH;
  private colorInput: HTMLInputElement;

  constructor() {
    this.tools = document.querySelectorAll('.tool');
    this.colorInput = document.querySelector(
      '.tool-color input[type="color"]'
    )!;

    this.initializeTools();
    this.initializeColorPicker();
    this.initBusListeners();
  }

  private initBusListeners(): void {
    const bus = EventBus.getInstance();

    bus.on(AppEvents.DRAWING_SET_TOOL, this.setActiveTool.bind(this));
  }

  private initializeTools() {
    this.colorInput.value = '#000000';
    this.tools.forEach((tool) => {
      tool.addEventListener('click', () => {
        const toolType = tool.dataset.tool as Tools;
        if (!toolType) return;

        if (toolType === Tools.COLOR) {
          return;
        }
        this.onToolClick(toolType);
        this.setActiveTool(toolType);
      });
    });

    this.setActiveTool(Tools.BRUSH);
  }

  private initializeColorPicker() {
    this.colorInput.addEventListener('input', (e) => {
      const newColor = (e.target as HTMLInputElement).value;
      this.onColorChange(newColor);
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

  public onToolClick(tool: Tools) {
    const bus = EventBus.getInstance();
    switch (tool) {
      case Tools.BRUSH:
      case Tools.ERASER: {
        bus.emit(AppEvents.DRAWING_SET_TOOL, tool);
        break;
      }
      case Tools.DELETE: {
        bus.emit(
          AppEvents.LAYER_CLEAR_ACTIVE,
          LayerController.getInstance().activeLayer
        );
        break;
      }
      case Tools.ZOOMIN: {
        bus.emit(AppEvents.CANVAS_ZOOM_IN, null);
        break;
      }
      case Tools.ZOOMOUT: {
        bus.emit(AppEvents.CANVAS_ZOOM_OUT, null);
        break;
      }
      case Tools.DOWNLOAD: {
        bus.emit(AppEvents.CANVAS_DOWNLOAD, null);
        break;
      }
      case Tools.UNDO: {
        bus.emit(AppEvents.HISTORY_UNDO, null);
        break;
      }
      case Tools.REDO: {
        bus.emit(AppEvents.HISTORY_REDO, null);
        break;
      }
    }
  }

  public onColorChange(color: string) {
    EventBus.getInstance().emit(AppEvents.BRUSH_COLOR_CHANGE, color);
  }
}
