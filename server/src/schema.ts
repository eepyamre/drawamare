import { schema, table, t } from 'spacetimedb/server';

export const Point = t.object('Point', {
  x: t.i32(),
  y: t.i32(),
});

export const StrokeStyle = t.object('StrokeStyle', {
  width: t.f32(),
  cap: t.string(),
  color: t.i32(),
  alpha: t.f32(),
});

export const Brush = t.object('Brush', {
  ratio: t.f32(),
  spikes: t.i32(),
  density: t.i32(),
  spacing: t.f32(),
  angle: t.i32(),
  shape: t.string(),
  brushType: t.string(),
  vFade: t.i32(),
  hFade: t.i32(),
  texture: t.string().optional(),
});

export const DrawCommand = t.object('DrawCommand', {
  commandType: t.string(),
  blendMode: t.string().optional(),
  pos: Point.optional(),
  strokeStyle: StrokeStyle.optional(),
  startWidth: t.i32().optional(),
  endWidth: t.i32().optional(),
  brush: Brush,
});

// Tables
export const User = table(
  { name: 'user', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string().optional(),
    online: t.bool(),
    linkedAccount: t.string().optional(),
  }
);

export const Layer = table(
  { name: 'layer', public: true },
  {
    id: t.i32().primaryKey().autoInc(),
    name: t.string().optional(),
    owner: t.identity(),
    base64: t.string().optional(),
    forceUpdate: t.bool(),
    callerConnectionId: t.connectionId().optional(),
  }
);

export const Command = table(
  { name: 'command', public: true },
  {
    id: t.i32().primaryKey().autoInc(),
    layer: t.i32(),
    owner: t.identity(),
    callerConnectionId: t.connectionId(),
    commands: t.array(DrawCommand),
  }
);

export const Account = table(
  { name: 'account' },
  {
    username: t.string().primaryKey(),
    passwordHash: t.string(),
    linkedIdentity: t.identity(),
  }
);

export const Cursor = table(
  { name: 'cursor', public: true },
  {
    owner: t.identity().primaryKey(),
    x: t.f32(),
    y: t.f32(),
    color: t.i32(),
    name: t.string().optional(),
  }
);

export default schema({ User, Layer, Command, Account, Cursor });
