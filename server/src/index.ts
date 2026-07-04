import spacetimedb, { DrawCommand } from './schema';
import { t, SenderError } from 'spacetimedb/server';

// Lifecycle Hooks
export const onConnect = spacetimedb.clientConnected((ctx) => {
  const existingUser = ctx.db.User.identity.find(ctx.sender);
  if (existingUser) {
    ctx.db.User.identity.update({ ...existingUser, online: true });
  } else {
    ctx.db.User.insert({
      identity: ctx.sender,
      name: undefined,
      online: true,
      linkedAccount: undefined,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  for (const cmd of ctx.db.Command.iter()) {
    if (cmd.owner.toHexString() === ctx.sender.toHexString()) {
      ctx.db.Command.id.delete(cmd.id);
    }
  }
  ctx.db.Cursor.owner.delete(ctx.sender);
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

    const cursor = ctx.db.Cursor.owner.find(ctx.sender);
    if (cursor) {
      ctx.db.Cursor.owner.update({ ...cursor, name });
    }
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

    const cursor = ctx.db.Cursor.owner.find(ctx.sender);
    if (cursor) {
      const updatedUser = ctx.db.User.identity.find(ctx.sender);
      const displayName = updatedUser?.name || username;
      ctx.db.Cursor.owner.update({ ...cursor, name: displayName });
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

    const cursor = ctx.db.Cursor.owner.find(ctx.sender);
    if (cursor) {
      const updatedUser = ctx.db.User.identity.find(ctx.sender);
      const displayName = updatedUser?.name || username;
      ctx.db.Cursor.owner.update({ ...cursor, name: displayName });
    }
  }
);

// Cursor Reducer

const identityColor = (hex: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < hex.length; i++) {
    hash ^= hex.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const h = (hash >>> 0) % 360;
  const s = 65 + ((hash >>> 8) % 20);
  const l = 50 + ((hash >>> 16) % 15);
  const c = (1 - Math.abs((2 * l) / 100 - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return (
    ((Math.round((r + m) * 255) << 16) |
      (Math.round((g + m) * 255) << 8) |
      Math.round((b + m) * 255)) &
    0xffffff
  );
};

export const moveCursor = spacetimedb.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const existing = ctx.db.Cursor.owner.find(ctx.sender);
    if (existing) {
      ctx.db.Cursor.owner.update({ ...existing, x, y });
    } else {
      const user = ctx.db.User.identity.find(ctx.sender);
      const displayName = user?.name || user?.linkedAccount || 'Anon';
      ctx.db.Cursor.insert({
        owner: ctx.sender,
        x,
        y,
        color: identityColor(ctx.sender.toHexString()),
        name: displayName,
      });
    }
  }
);

export default spacetimedb;
