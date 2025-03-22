import { PointData, Point } from 'pixi.js';

export const vAdd = (v: PointData, w: PointData): Point => {
  return new Point(v.x + w.x, v.y + w.y);
};

export const vSub = (v: PointData, w: PointData): Point => {
  return new Point(v.x - w.x, v.y - w.y);
};

export const vScale = (v: PointData, scale: number): Point => {
  return new Point(v.x * scale, v.y * scale);
};
