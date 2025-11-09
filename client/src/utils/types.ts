import { PixiController } from '../controllers/pixi';
import { Container, RenderTexture, Point } from 'pixi.js';
import { Identity } from 'spacetimedb';

export type History = RenderTexture[];

export type Layer = {
  id: number;
  container: Container;
  rt: RenderTexture;
  ownerId: Identity;
  ownerName: string;
  title: string;
};

export enum BLEND_MODES {
  INHERIT = 'inherit',
  NORMAL = 'normal',
  ADD = 'add',
  MULTIPLY = 'multiply',
  SCREEN = 'screen',
  DARKEN = 'darken',
  LIGHTEN = 'lighten',
  ERASE = 'erase',
  COLOR_DODGE = 'color-dodge',
  COLOR_BURN = 'color-burn',
  LINEAR_BURN = 'linear-burn',
  LINEAR_DODGE = 'linear-dodge',
  LINEAR_LIGHT = 'linear-light',
  HARD_LIGHT = 'hard-light',
  SOFT_LIGHT = 'soft-light',
  PIN_LIGHT = 'pin-light',
  DIFFERENCE = 'difference',
  EXCLUSION = 'exclusion',
  OVERLAY = 'overlay',
  SATURATION = 'saturation',
  COLOR = 'color',
  LUMINOSITY = 'luminosity',
  NORMAL_NPM = 'normal-npm',
  ADD_NPM = 'add-npm',
  SCREEN_NPM = 'screen-npm',
  NONE = 'none',
  SUBTRACT = 'subtract',
  DIVIDE = 'divide',
  VIVID_LIGHT = 'vivid-light',
  HARD_MIX = 'hard-mix',
  NEGATION = 'negation',
  MIN = 'min',
  MAX = 'max',
}

export type Brush = {
  ratio: number;
  spikes: number;
  density: number;
  spacing: number;
  angle: number;
};

export type BrushExtended = Brush & { size?: number; color?: number };

export type StampFn = (
  pixiCtr: PixiController,
  layer: Layer,
  position: Point,
  diameter: number,
  color: number,
  alpha: number,
  blendMode: BLEND_MODES,
  clearCache: boolean
) => void;
