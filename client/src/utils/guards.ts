import { Brushes } from './types';

export const isBrush = (brushName: string): brushName is Brushes => {
  if (new Set(Object.values(Brushes)).has(brushName as Brushes)) {
    return true;
  }
  return false;
};
