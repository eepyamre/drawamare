import { Container, Point, RenderTexture, StrokeStyle } from 'pixi.js';

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
  id: string;
  container: Container;
  rt: RenderTexture;
  ownerId: string;
  ownerName: string;
  title: string;
};
