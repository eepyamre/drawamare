import { Application, Container } from 'pixi.js';

import { BrushEngine } from '../controllers/BrushEngine';
import { Brush, BrushWithPreview, DEFAULT_BRUSH } from '../utils';

export type BrushEditorCallbacks = {
  onSave: (brush: BrushWithPreview, editingIndex: number | null) => void;
  onCancel: () => void;
};

export class BrushEditorUI {
  private app: Application | null = null;
  private brush: Brush = { ...DEFAULT_BRUSH };
  private editingIndex: number | null = null;

  private root: HTMLDivElement;
  private stampEl: HTMLDivElement | null = null;
  private addBrushBtn: HTMLButtonElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;
  private closeBtn: HTMLButtonElement | null = null;

  private callbacks: BrushEditorCallbacks;

  constructor(editorRoot: string, callbacks: BrushEditorCallbacks) {
    this.callbacks = callbacks;
    this.root = document.querySelector<HTMLDivElement>(editorRoot)!;

    if (!this.root) {
      throw new Error('No editor node found');
    }

    this.initializeElements();
    this.attachEventListeners();
  }

  private initializeElements(): void {
    this.stampEl = this.root.querySelector<HTMLDivElement>('.brush-stamp')!;
    this.addBrushBtn = document.querySelector<HTMLButtonElement>('.brush-add');
    this.saveBtn =
      this.root.querySelector<HTMLButtonElement>('#brush-editor_save');
    this.closeBtn = this.root.querySelector<HTMLButtonElement>(
      '#brush-editor_close'
    );

    const ratioEl = this.root.querySelector<HTMLLabelElement>('#ratio');
    const spikesEl = this.root.querySelector<HTMLLabelElement>('#spikes');
    const densityEl = this.root.querySelector<HTMLLabelElement>('#density');
    const spacingEl = this.root.querySelector<HTMLLabelElement>('#spacing');
    const angleEl = this.root.querySelector<HTMLLabelElement>('#angle');
    const horizontalEl = this.root.querySelector<HTMLLabelElement>('#h-fade');
    const verticalEl = this.root.querySelector<HTMLLabelElement>('#v-fade');
    const circleBtn = this.root.querySelector<HTMLLabelElement>('#circle-btn');
    const squareBtn = this.root.querySelector<HTMLLabelElement>('#square-btn');

    if (
      [
        this.stampEl,
        this.saveBtn,
        ratioEl,
        spacingEl,
        spikesEl,
        densityEl,
        angleEl,
        circleBtn,
        squareBtn,
        this.closeBtn,
        this.addBrushBtn,
        horizontalEl,
        verticalEl,
      ].some((item) => item === null)
    ) {
      throw new Error('Invalid node layout - missing required elements');
    }

    this.initInput(ratioEl!, 'ratio');
    this.initInput(spacingEl!, 'spacing');
    this.initInput(spikesEl!, 'spikes');
    this.initInput(densityEl!, 'density');
    this.initInput(angleEl!, 'angle');
    this.initInput(horizontalEl!, 'hFade');
    this.initInput(verticalEl!, 'vFade');

    circleBtn!.addEventListener('click', () => {
      this.brush.shape = 'circle';
      this.drawStampEditor();
    });

    squareBtn!.addEventListener('click', () => {
      this.brush.shape = 'square';
      this.drawStampEditor();
    });

    this.addBrushBtn!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
      this.toggle();
    });
  }

  private attachEventListeners(): void {
    if (!this.saveBtn || !this.closeBtn) return;

    this.saveBtn.addEventListener('click', () => {
      this.onSave();
    });

    this.closeBtn.addEventListener('click', () => {
      this.toggle();
      this.callbacks.onCancel();
    });

    document.addEventListener('click', (e) => {
      if (
        !this.root.classList.contains('hidden') &&
        !this.root.contains(e.target as Node) &&
        this.addBrushBtn &&
        !this.addBrushBtn.contains(e.target as Node)
      ) {
        this.root.classList.add('hidden');
      }
    });
  }

  private initInput(
    element: HTMLLabelElement,
    key:
      | 'ratio'
      | 'spikes'
      | 'density'
      | 'spacing'
      | 'angle'
      | 'hFade'
      | 'vFade'
  ): void {
    const input = element.querySelector<HTMLInputElement>('input');
    const span = element.querySelector<HTMLSpanElement>('span');

    if (!input || !span) {
      throw new Error('Invalid input layout');
    }

    input.addEventListener('input', (e) => {
      const value = Number((e.currentTarget as HTMLInputElement)!.value);
      span.textContent = String(value);
      this.brush[key] = value;
      this.drawStampEditor();
    });

    input.value = String(this.brush[key]);
    span.textContent = String(this.brush[key]);
  }

  async initPixi(): Promise<void> {
    this.app = new Application();

    await this.app.init({
      background: '#ccc',
      antialias: true,
      width: 150,
      height: 150,
    });

    if (!this.stampEl) throw new Error('[BrushEditorUI] No StampEl');
    this.stampEl.appendChild(this.app.canvas);
    this.drawStampEditor();
  }

  toggle(): void {
    if (this.root.classList.contains('hidden')) {
      this.root.classList.remove('hidden');
    } else {
      this.root.classList.add('hidden');
    }
  }

  reset(): void {
    this.editingIndex = null;
    this.brush = { ...DEFAULT_BRUSH };

    const updateInput = (id: string, value: number) => {
      const el = this.root.querySelector<HTMLLabelElement>(`#${id}`);
      if (el) {
        const input = el.querySelector<HTMLInputElement>('input');
        const span = el.querySelector<HTMLSpanElement>('span');
        if (input && span) {
          input.value = String(value);
          span.textContent = String(value);
        }
      }
    };

    updateInput('ratio', this.brush.ratio);
    updateInput('spikes', this.brush.spikes);
    updateInput('density', this.brush.density);
    updateInput('spacing', this.brush.spacing);
    updateInput('angle', this.brush.angle);
    updateInput('h-fade', this.brush.hFade);
    updateInput('v-fade', this.brush.vFade);

    this.drawStampEditor();
  }

  loadBrush(brush: BrushWithPreview, index: number): void {
    this.editingIndex = index;
    this.brush = { ...brush };

    const updateInput = (id: string, value: number) => {
      const el = this.root.querySelector<HTMLLabelElement>(`#${id}`);
      if (el) {
        const input = el.querySelector<HTMLInputElement>('input');
        const span = el.querySelector<HTMLSpanElement>('span');
        if (input && span) {
          input.value = String(value);
          span.textContent = String(value);
        }
      }
    };

    updateInput('ratio', this.brush.ratio);
    updateInput('spikes', this.brush.spikes);
    updateInput('density', this.brush.density);
    updateInput('spacing', this.brush.spacing);
    updateInput('angle', this.brush.angle);
    updateInput('h-fade', this.brush.hFade);
    updateInput('v-fade', this.brush.vFade);

    this.drawStampEditor();
    if (this.root.classList.contains('hidden')) {
      this.toggle();
    }
  }

  private drawStampEditor() {
    if (!this.app) return;

    const stage = this.app.stage;
    stage.removeChildren();

    const stamp = BrushEngine.drawStamp(this.app.renderer!, {
      ...this.brush,
      size: 75, // Preview size
      color: 0x000000,
    });

    if (stamp) stage.addChild(stamp);
    return stage;
  }

  private async onSave(): Promise<void> {
    if (!this.app) return;

    const stamp = this.drawStampEditor();
    if (!stamp) return;

    const container = new Container();
    container.addChild(stamp);
    const preview = await this.app.renderer.extract.base64(container);

    if (!preview) return;

    container.destroy(true);

    const brushWithPreview: BrushWithPreview = {
      ...this.brush,
      preview,
    };

    this.callbacks.onSave(brushWithPreview, this.editingIndex);

    this.toggle();
  }

  destroy(): void {
    this.app?.destroy(true);
  }
}
