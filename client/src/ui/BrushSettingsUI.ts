import { AppEvents, EventBus, EventData } from '../events';
import {
  Brush,
  BrushWithPreview,
  DEFAULT_BRUSH,
  getLocalBrushes,
} from '../utils';

export type PressureSettings = {
  size: boolean;
  opacity: boolean;
};

export class BrushSettingsUI {
  private static instance: BrushSettingsUI;

  private sizeSlider: HTMLInputElement;
  private opacitySlider: HTMLInputElement;
  private pressureSizeCheckbox: HTMLInputElement;
  private pressureOpacityCheckbox: HTMLInputElement;
  private brushList: HTMLDivElement;
  private activeBrush: string;
  private contextMenu: HTMLElement;
  private contextMenuEdit: HTMLElement;
  private contextMenuDelete: HTMLElement;
  private targetBrushIndex: number | null = null;

  constructor() {
    this.sizeSlider = document.querySelector<HTMLInputElement>('#brush-size')!;
    this.opacitySlider =
      document.querySelector<HTMLInputElement>('#brush-opacity')!;
    this.pressureSizeCheckbox =
      document.querySelector<HTMLInputElement>('#pressure-size')!;
    this.pressureOpacityCheckbox =
      document.querySelector<HTMLInputElement>('#pressure-opacity')!;
    this.brushList = document.querySelector<HTMLDivElement>('.brush-list')!;

    this.contextMenu = document.getElementById('brush-context-menu')!;
    this.contextMenuEdit = document.getElementById('context-menu-edit')!;
    this.contextMenuDelete = document.getElementById('context-menu-delete')!;

    const initialActiveBrush = document.querySelector('.brush-item.active');
    this.activeBrush = initialActiveBrush?.getAttribute('title') || 'Round';

    this.initBusListeners();
    this.initContextMenu();
    this.initBrushes();
    this.initEventListeners();
  }

  static getInstance(): BrushSettingsUI {
    if (!this.instance) {
      this.instance = new BrushSettingsUI();
    }

    return this.instance;
  }

  initBusListeners() {
    const bus = EventBus.getInstance();
    bus.on(AppEvents.BRUSH_EDITOR_SAVE, this.onBrushEditorSave.bind(this));

    bus.on(AppEvents.BRUSH_EDITOR_CANCEL, () => {
      console.log('Brush editor cancelled');
    });
  }

  private onBrushEditorSave({
    brush,
    editingIndex,
  }: EventData[AppEvents.BRUSH_EDITOR_SAVE]) {
    const localBrushes = getLocalBrushes();
    if (editingIndex !== null) {
      localBrushes[editingIndex] = brush;
      this.setActiveBrush(`Custom Brush ${editingIndex + 1}`);
    } else {
      localBrushes.push(brush);
      this.setActiveBrush(`Custom Brush ${localBrushes.length}`);
    }

    localStorage.setItem('brushes', JSON.stringify(localBrushes));

    if (editingIndex === null) {
      this.initBrushes();
    }
  }

  private initContextMenu() {
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target as Node)) {
        this.contextMenu.classList.add('hidden');
      }
    });

    this.contextMenuEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.targetBrushIndex !== null) {
        const brushes = getLocalBrushes();
        if (brushes[this.targetBrushIndex]) {
          this.onEditBrush?.({
            brush: brushes[this.targetBrushIndex],
            index: this.targetBrushIndex,
          });
        }
        this.contextMenu.classList.add('hidden');
      }
    });

    this.contextMenuDelete.addEventListener('click', () => {
      if (this.targetBrushIndex !== null) {
        const brushes = getLocalBrushes();
        brushes.splice(this.targetBrushIndex, 1);
        localStorage.setItem('brushes', JSON.stringify(brushes));
        this.initBrushes();
        this.contextMenu.classList.add('hidden');
      }
    });
  }

  public initBrushes() {
    const existingButtons = this.brushList.querySelectorAll(
      '.brush-item[data-index]'
    );
    existingButtons.forEach((btn) => btn.remove());
    const brushes = getLocalBrushes();
    let lastBrush: string | null = null;
    if (!brushes) return;

    const addBtn = this.brushList.querySelector('.brush-add');

    brushes.forEach((brush, i) => {
      const btn = document.createElement('button');
      btn.dataset.index = String(i);
      btn.title = `Custom Brush ${i + 1}`;
      btn.classList.add('brush-item');
      const img = document.createElement('img');
      img.src = brush.preview;
      img.classList.add('brush-custom');
      btn.append(img);

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.targetBrushIndex = i;
        this.contextMenu.style.top = `${e.clientY}px`;
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.classList.remove('hidden');
      });

      if (addBtn) {
        this.brushList.insertBefore(btn, addBtn);
      } else {
        this.brushList.append(btn);
      }
      lastBrush = btn.title;
    });
    return lastBrush;
  }

  private initEventListeners() {
    this.sizeSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.onSizeChange?.(value);
    });

    this.opacitySlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.onOpacityChange?.(value);
    });

    const handlePressureChange = () => {
      this.onPressureToggle?.({
        size: this.pressureSizeCheckbox.checked,
        opacity: this.pressureOpacityCheckbox.checked,
      });
    };

    this.pressureSizeCheckbox.addEventListener('change', handlePressureChange);
    this.pressureOpacityCheckbox.addEventListener(
      'change',
      handlePressureChange
    );

    this.brushList.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (button?.tagName !== 'BUTTON' || button.title === 'Add') return;
      const brushName = button.getAttribute('title');
      const brushIndex = button.dataset.index;
      if (brushName) {
        const brushes = getLocalBrushes();
        if (brushIndex && brushes[Number(brushIndex)]) {
          this.onBrushChange?.(brushes[Number(brushIndex)]);
          this.setActiveBrush(brushName);
          return;
        }
        this.onBrushChange?.(DEFAULT_BRUSH);
        this.setActiveBrush(brushName);
      }
    });
  }

  public onSizeChange(size: number) {
    EventBus.getInstance().emit(AppEvents.BRUSH_SIZE_CHANGE, size);
  }

  public onOpacityChange(opacity: number) {
    EventBus.getInstance().emit(AppEvents.BRUSH_OPACITY_CHANGE, opacity);
  }

  public onPressureToggle(settings: PressureSettings) {
    EventBus.getInstance().emit(AppEvents.BRUSH_PRESSUTE_TOGGLE, settings);
  }

  public onBrushChange(brush: Brush) {
    EventBus.getInstance().emit(AppEvents.BRUSH_CHANGE, brush);
  }

  public onEditBrush(data: { brush: BrushWithPreview; index: number }) {
    EventBus.getInstance().emit(AppEvents.BRUSH_EDIT, data);
  }

  public setActiveBrush(brushName: string) {
    Array.from(this.brushList.children).forEach((button) => {
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
