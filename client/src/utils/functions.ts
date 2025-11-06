import { Point } from 'pixi.js';

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
