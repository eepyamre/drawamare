import { Tools } from '../utils';

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
