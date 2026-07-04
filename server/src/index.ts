import spacetimedb, { DrawCommand } from './schema';
import { t, SenderError } from 'spacetimedb/server';

// Lifecycle Hooks
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const existingUser = ctx.db.User.identity.find(ctx.sender);
  if (existingUser) {
    ctx.db.User.identity.update({ ...existingUser, online: true });
  } else {
    ctx.db.User.insert({ identity: ctx.sender, name: undefined, online: true, linkedAccount: undefined });
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
    if (!ctx.connectionId) {
      throw new SenderError('No connection');
    }
    const existingLayer = ctx.db.Layer.id.find(layer);

    if (existingLayer) {
      ctx.db.Layer.id.update({
        ...existingLayer,
        base64,
        forceUpdate,
        callerConnectionId: ctx.connectionId,
      });
    } else {
      ctx.db.Layer.insert({
        id: 0,
        owner: ctx.sender,
        base64,
        name: undefined,
        forceUpdate: true,
        callerConnectionId: ctx.connectionId,
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
    callerConnectionId: ctx.connectionId ?? undefined,
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

    ctx.db.Layer.id.update({ ...existingLayer, name });
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

    if (!ctx.connectionId) {
      throw new SenderError('No connection');
    }

    ctx.db.Command.insert({
      id: 0,
      layer,
      commands,
      owner: ctx.sender,
      callerConnectionId: ctx.connectionId,
    });
  }
);

export const register = spacetimedb.reducer(
  {
    username: t.string(),
    passwordHash: t.string(),
  },
  (ctx, { username, passwordHash }) => {
    if (!username || username.length === 0) {
      throw new SenderError('Username must not be empty');
    }
    if (!passwordHash) {
      throw new SenderError('Password hash is required');
    }

    const existing = ctx.db.Account.username.find(username);
    if (existing) {
      throw new SenderError(`Username "${username}" is already taken`);
    }

    ctx.db.Account.insert({
      username,
      passwordHash,
      linkedIdentity: ctx.sender,
    });

    const user = ctx.db.User.identity.find(ctx.sender);
    if (user) {
      ctx.db.User.identity.update({ ...user, linkedAccount: username });
    }
  }
);

export const login = spacetimedb.reducer(
  {
    username: t.string(),
    passwordHash: t.string(),
  },
  (ctx, { username, passwordHash }) => {
    if (!username) {
      throw new SenderError('Username is required');
    }

    const account = ctx.db.Account.username.find(username);
    if (!account) {
      throw new SenderError(`No account named "${username}"`);
    }
    if (account.passwordHash !== passwordHash) {
      throw new SenderError('Invalid password');
    }

    if (!account.linkedIdentity.isEqual(ctx.sender)) {
      for (const layer of ctx.db.Layer.iter()) {
        if (layer.owner.isEqual(account.linkedIdentity)) {
          ctx.db.Layer.id.update({ ...layer, owner: ctx.sender });
        }
      }

      const oldUser = ctx.db.User.identity.find(account.linkedIdentity);
      if (oldUser) {
        ctx.db.User.identity.update({ ...oldUser, linkedAccount: undefined });
      }

      ctx.db.Account.username.update({
        ...account,
        linkedIdentity: ctx.sender,
      });
    }

    const user = ctx.db.User.identity.find(ctx.sender);
    if (user) {
      ctx.db.User.identity.update({ ...user, linkedAccount: username });
    }
  }
);

export default spacetimedb;
