import { Container, Graphics, Text } from 'pixi.js';
import { Identity } from 'spacetimedb';

import { EventContext } from '../module_bindings';
import { Cursor as ServerCursor } from '../module_bindings/types';
import { NetworkController } from './NetworkController';
import { PixiController } from './PixiController';

type CursorSprite = {
  container: Container;
  dot: Graphics;
  label: Text;
  lastSeen: number;
};

export class CursorController {
  private static instance: CursorController;
  private cursors = new Map<string, CursorSprite>();

  static getInstance = (): CursorController => {
    if (!this.instance) this.instance = new CursorController();
    return this.instance;
  };

  private constructor() {
    this.initListeners();
    PixiController.app.ticker.add(this.tick);
  }

  private initListeners = () => {
    const db = NetworkController.getInstance().getClientDb();

    db?.Cursor.onInsert((_ctx: EventContext, cursor: ServerCursor) => {
      this.upsertCursor(cursor);
    });

    db?.Cursor.onUpdate(
      (_ctx: EventContext, _old: ServerCursor, next: ServerCursor) => {
        this.upsertCursor(next);
      }
    );

    db?.Cursor.onDelete((_ctx: EventContext, cursor: ServerCursor) => {
      this.removeCursor(cursor.owner);
    });
  };

  private upsertCursor = (cursor: ServerCursor) => {
    if (
      !NetworkController.identity ||
      cursor.owner.isEqual(NetworkController.identity)
    )
      return;

    const key = cursor.owner.toHexString();
    const existing = this.cursors.get(key);

    if (existing) {
      existing.container.position.set(cursor.x, cursor.y);
      existing.lastSeen = performance.now();
      existing.container.alpha = 1;
      existing.label.text = cursor.name || 'Anon';
      return;
    }

    const color = cursor.color & 0xffffff;
    const dot = new Graphics().circle(0, 0, 5).fill(color);
    dot.stroke({ width: 1, color: 0xffffff });

    const label = new Text({
      text: cursor.name || 'Anon',
      style: { fontSize: 12, fill: color },
    });
    label.position.set(8, -8);

    const container = new Container();
    container.addChild(dot);
    container.addChild(label);
    container.position.set(cursor.x, cursor.y);
    container.zIndex = 50;

    PixiController.board.addChild(container);
    this.cursors.set(key, {
      container,
      dot,
      label,
      lastSeen: performance.now(),
    });
  };

  private removeCursor = (identity: Identity) => {
    const key = identity.toHexString();
    const sprite = this.cursors.get(key);
    if (!sprite) return;
    sprite.container.destroy({ children: true });
    this.cursors.delete(key);
  };

  private tick = () => {
    const now = performance.now();
    for (const [key, sprite] of this.cursors) {
      const age = now - sprite.lastSeen;
      if (age > 5000) {
        sprite.container.destroy({ children: true });
        this.cursors.delete(key);
        continue;
      }
      if (age > 1500) {
        sprite.container.alpha = Math.max(0, 1 - (age - 1500) / 3500);
      } else {
        sprite.container.alpha = 1;
      }
    }
  };
}
