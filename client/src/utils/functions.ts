import { Point } from 'pixi.js';

import { Brush as BrushSpacetime } from '../module_bindings';
import { Brush, BrushWithPreview } from './types';

export const distance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export const wait = (ms: number) => {
  return new Promise<void>((res) => {
    setTimeout(() => res(), ms);
  });
};

export const rotatePoint = (
  px: number,
  py: number,
  angle: number,
  cx: number,
  cy: number
) => {
  const dx = px - cx;
  const dy = py - cy;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: cx + dx * cosA - dy * sinA,
    y: cy + dx * sinA + dy * cosA,
  };
};

export const getLocalBrushes = () => {
  const brushes: BrushWithPreview[] = JSON.parse(
    localStorage.getItem('brushes') ?? '[]'
  );
  return brushes;
};

export const brushToSpacetime = (brush: Brush): BrushSpacetime => {
  return {
    ...brush,
    brushType: brush.type,
    texture: brush.texture,
  };
};

export const spacetimeToBrush = (brush: BrushSpacetime): Brush => {
  return {
    ...brush,
    type: brush.brushType === 'texture' ? 'texture' : 'auto',
    texture: brush.texture,
    shape: brush.shape === 'circle' ? 'circle' : 'square',
  };
};
