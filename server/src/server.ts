import { Server, Socket } from 'socket.io';
import http from 'http';

type Point = {
  x: number;
  y: number;
};

type StrokeStyle = object;

type DrawCommand = { layerId: string } & (
  | {
      command: 'initLine';
      blendMode?: 'erase' | 'normal';
      pos: Point;
      strokeStyle: StrokeStyle;
    }
  | {
      pos: Point;
      command: 'line';
    }
  | {
      command: 'endLine';
    }
);

type DrawCommands = DrawCommand[];

type StrokePayload = {
  layerId: string;
  commands: DrawCommands;
};

type SaveLayerPayload = {
  layerId: string;
  timestamp: number;
  base64: string;
};

type CreateLayerPayload = {
  id: string;
};

const httpServer = http.createServer();
const io = new Server(httpServer);

// Track user layers. Save the last base64 state
let layers: {
  id: string;
  title: string;
  ownerId: string;
  timestamp: number;
  base64: string;
}[] = [];
const userConnections: { [userId: string]: Socket } = {};

io.on('connection', (socket: Socket) => {
  const userId = socket.id;
  userConnections[userId] = socket;

  console.log(`User ${userId} connected`);

  socket.on('getUsers', () => {
    socket.emit('userlist', Object.keys(userConnections));
  });

  socket.on('getLayers', () => {
    socket.emit('layers', layers);
  });

  socket.on('drawCommand', (payload: StrokePayload) => {
    console.log(`Received draw command from ${userId}`);
    socket.broadcast.emit('drawCommand', {
      userId: socket.id,
      layerId: payload.layerId,
      commands: payload.commands,
    });
  });

  socket.on('redraw', (payload: SaveLayerPayload) => {
    console.log(`Received redraw command from ${userId}`);
    let l = layers.find((item) => item.id === payload.layerId);
    if (!l) {
      l = {
        id: payload.layerId,
        title: 'New Layer',
        ownerId: userId,
        timestamp: payload.timestamp,
        base64: payload.base64,
      };
      layers.push(l);
    }

    // don't save if userlayers have a newer item than the one we're saving
    if (l.timestamp < payload.timestamp) {
      l.base64 = payload.base64;

      socket.broadcast.emit('redraw', {
        userId: socket.id,
        layerId: payload.layerId,
        base64: payload.base64,
      });
    }
  });

  socket.on('saveLayer', (payload: SaveLayerPayload) => {
    console.log(`Received save layer command from ${userId}`);
    let l = layers.find((item) => item.id === payload.layerId);
    if (!l) {
      l = {
        id: payload.layerId,
        title: 'New Layer',
        ownerId: userId,
        timestamp: payload.timestamp,
        base64: payload.base64,
      };
      layers.push(l);
    }

    // don't save if userlayers have a newer item than the one we're saving
    if (l.timestamp < payload.timestamp) {
      l.base64 = payload.base64;
    }
  });

  socket.on('createLayer', (payload: CreateLayerPayload) => {
    console.log(`Received create layer command from ${userId}`);
    socket.broadcast.emit('createLayer', { userId, layer: payload });
  });

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
    layers = layers.filter((l) => l.ownerId !== userId); // TMP. Remove on production
    delete userConnections[userId];
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
