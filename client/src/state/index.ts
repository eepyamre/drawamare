import { signal } from '@preact/signals';

export interface Layer {
  id: string;
  name: string;
  canvasEl: HTMLCanvasElement | null;
  context: CanvasRenderingContext2D | null;
  historyStack: ImageData[];
  historyIndex: number;
}

export const createLayersState = () => {
  const layers = signal<Layer[]>([]);
  const activeLayerId = signal<string | null>(null);

  return { layers, activeLayerId };
};
