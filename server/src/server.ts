import SocketIO, { Server } from 'socket.io';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

type Point = {
  x: number;
  y: number;
};

type StrokeStyle = object;

type DrawCommand =
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

type DrawCommands = DrawCommand[];

type SaveLayerPayload = {
  timestamp: number;
  base64: string;
};

type Socket = SocketIO.Socket & {
  username?: string;
};

const httpServer = http.createServer();
const io = new Server(httpServer);

// Track user layers. Save the last base64 state
const userLayers: {
  [userId: string]: {
    timestamp: number;
    base64: string;
  };
} = {};
const userConnections: { [userId: string]: Socket } = {};

io.on('connection', (socket: Socket) => {
  const userId = socket.id;
  userConnections[userId] = socket;

  console.log(`User ${userId} connected`);

  socket.on('getUsers', () => {
    socket.emit('userlist', Object.keys(userConnections));
  });

  socket.on('getLayers', () => {
    socket.emit(
      'userLayers',
      Object.keys(userLayers).map((key) => ({
        userId: key,
        base64: userLayers[key].base64,
      }))
    );
  });

  socket.on('drawCommand', (commands: DrawCommands) => {
    console.log(`Received draw command from ${userId}`);
    socket.broadcast.emit('drawCommand', { userId: socket.id, commands });
  });

  socket.on('redraw', (payload: SaveLayerPayload) => {
    console.log(`Received redraw command from ${userId}`);
    userLayers[userId] = payload;

    socket.broadcast.emit('redraw', {
      userId: socket.id,
      base64: payload.base64,
    });
  });

  socket.on('saveLayer', (payload: SaveLayerPayload) => {
    console.log(`Received save layer command from ${userId}`);
    // don't save if userlayers have a newer item than the one we're saving
    if (userLayers[userId]?.timestamp > payload.timestamp) return;
    userLayers[userId] = payload;
  });

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
    delete userLayers[userId]; // TMP. Remove on production
    delete userConnections[userId];
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
