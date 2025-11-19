import { Brush } from './types';

export const boardSize = {
  width: 2048,
  height: 2048,
};

export const maxScale = 3;
export const minScale = 0.5;

export const maxHistoryLength = 20;

export const MAX_DOTS_AT_FULL_DENSITY = 500;

export const DEFAULT_BRUSH: Brush = {
  angle: 0,
  density: 100,
  ratio: 1,
  spikes: 12,
  spacing: 1,
  shape: 'circle',
  hFade: 0,
  vFade: 0,
};
