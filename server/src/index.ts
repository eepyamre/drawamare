import spacetimedb, { DrawCommand } from './schema';
import { t, SenderError } from 'spacetimedb/server';

// Lifecycle Hooks
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const existingUser = ctx.db.User.identity.find(ctx.sender);
  if (existingUser) {
    ctx.db.User.identity.update({ ...existingUser, online: true });
  } else {
    ctx.db.User.insert({ identity: ctx.sender, name: undefined, online: true });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  for (const cmd of ctx.db.Command.iter()) {
    if (cmd.owner.toHexString() === ctx.sender.toHexString()) {
      ctx.db.Command.id.delete(cmd.id);
    }
  }
});

// Reducers
export const setName = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name || name.length === 0) {
      throw new SenderError('Name must not be empty');
    }

    const user = ctx.db.User.identity.find(ctx.sender);
    if (!user) {
      throw new SenderError('Cannot set name for unknown user');
    }

    ctx.db.User.identity.update({ ...user, name });
  }
);

export const saveLayer = spacetimedb.reducer(
  {
    layer: t.i32(),
    base64: t.string(),
    forceUpdate: t.bool(),
  },
  (ctx, { layer, base64, forceUpdate }) => {
    const existingLayer = ctx.db.Layer.id.find(layer);

    if (existingLayer) {
      ctx.db.Layer.id.update({
        ...existingLayer,
        owner: ctx.sender,
        base64,
        forceUpdate,
      });
    } else {
      ctx.db.Layer.insert({
        id: 0,
        owner: ctx.sender,
        base64,
        name: undefined,
        forceUpdate: true,
      });
    }
  }
);

export const createLayer = spacetimedb.reducer((ctx) => {
  ctx.db.Layer.insert({
    id: 0,
    owner: ctx.sender,
    base64: undefined,
    name: undefined,
    forceUpdate: true,
  });
});

export const deleteLayer = spacetimedb.reducer(
  { layer: t.i32() },
  (ctx, { layer }) => {
    ctx.db.Layer.id.delete(layer);
  }
);

export const renameLayer = spacetimedb.reducer(
  { layer: t.i32(), name: t.string() },
  (ctx, { layer, name }) => {
    const existingLayer = ctx.db.Layer.id.find(layer);
    if (!existingLayer) {
      throw new SenderError(
        `Rename layer event for an unknown layer with id ${layer}`
      );
    }

    ctx.db.Layer.id.update({ ...existingLayer, owner: ctx.sender, name });
  }
);

export const sendCommand = spacetimedb.reducer(
  {
    layer: t.i32(),
    commands: t.array(DrawCommand),
  },
  (ctx, { layer, commands }) => {
    const layerExists = ctx.db.Layer.id.find(layer);
    if (!layerExists) {
      throw new SenderError(`Layer with id ${layer} does not exist`);
    }

    ctx.db.Command.insert({
      id: 0,
      layer,
      commands,
      owner: ctx.sender,
    });
  }
);

export default spacetimedb;
