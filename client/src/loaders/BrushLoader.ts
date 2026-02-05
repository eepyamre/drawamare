import { Assets, Texture } from 'pixi.js';

export type TextureId = string;

export type SpriteAsset = {
  id: TextureId;
  name: string;
  path: string;
};

export const PREDEFINED_BRUSHES: SpriteAsset[] = [
  {
    id: 'chisel_eroded',
    name: 'Chisel eroded',
    path: '/assets/brushes/chisel_eroded.png',
  },
  {
    id: 'chisel_soft',
    name: 'Chisel soft',
    path: '/assets/brushes/chisel_soft.png',
  },
  {
    id: 'oil_bristle',
    name: 'Oil bristle',
    path: '/assets/brushes/oil_bristle.png',
  },
  {
    id: 'rake',
    name: 'Rake',
    path: '/assets/brushes/rake.png',
  },
  {
    id: 'smack',
    name: 'Smack',
    path: '/assets/brushes/smack.png',
  },
];

export class BrushLoader {
  static async loadAll(): Promise<void> {
    await Promise.allSettled(
      PREDEFINED_BRUSHES.map((sprite) => Assets.load(sprite.path))
    );
  }

  // todo: move brushes to map
  static getBrushTip(brushTip: string): Texture | null {
    const tip = PREDEFINED_BRUSHES.find((sprite) => sprite.id === brushTip);
    if (tip) {
      return Assets.get(tip?.path);
    }
    console.log('Undefined brush tip');
    return null;
  }
}
