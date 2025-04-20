import { Identity } from '@clockworklabs/spacetimedb-sdk';
import {
  BLEND_MODES,
  Container,
  Point,
  RenderTexture,
  StrokeStyle,
} from 'pixi.js';

export type DrawCommand =
  | {
      command: 'initLine';
      blendMode?: 'erase' | 'normal';
      pos: Point;
      strokeStyle: StrokeStyle;
    }
  | {
      command: 'line';
      pos: Point;
    }
  | {
      command: 'endLine';
    };

export type CommandBlock = DrawCommand[];

export type History = RenderTexture[];

export type DrawCommandPayload = {
  userId: string;
  layerId: string;
  commands: DrawCommand[];
};

export type RedrawPayload = {
  userId: string;
  layerId: string;
  base64: string;
};

export type LayersPayload = {
  id: string;
  userId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  base64?: string;
}[];

export type Layer = {
  id: number;
  container: Container;
  rt: RenderTexture;
  ownerId: Identity;
  ownerName: string;
  title: string;
};

export const checkBlendModes = (mode?: string): BLEND_MODES => {
  const modes: BLEND_MODES[] = [
    'inherit',
    'normal',
    'add',
    'multiply',
    'screen',
    'darken',
    'lighten',
    'erase',
    'color-dodge',
    'color-burn',
    'linear-burn',
    'linear-dodge',
    'linear-light',
    'hard-light',
    'soft-light',
    'pin-light',
    'difference',
    'exclusion',
    'overlay',
    'saturation',
    'color',
    'luminosity',
    'normal-npm',
    'add-npm',
    'screen-npm',
    'none',
    'subtract',
    'divide',
    'vivid-light',
    'hard-mix',
    'negation',
    'min',
    'max',
  ];

  if (!mode || !modes.includes(mode as BLEND_MODES)) {
    return 'normal';
  }
  return mode as BLEND_MODES;
};
