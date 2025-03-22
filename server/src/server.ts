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

interface Stroke {
  id: string;
}

type Socket = SocketIO.Socket & {
  username?: string;
};

const httpServer = http.createServer();
const io = new Server(httpServer);

// Track user layers. Now storing array of strokes for each user.
const userStrokes: { [userId: string]: Stroke[] } = {};
const userConnections: { [userId: string]: Socket } = {};

io.on('connection', (socket: Socket) => {
  const userId = socket.id;
  userConnections[userId] = socket;

  console.log(`User ${userId} connected`);

  socket.emit('userlist', Object.keys(userConnections));

  socket.on('drawCommand', (commands: DrawCommands) => {
    console.log(`Received draw command from ${userId}`);
    socket.broadcast.emit('drawCommand', { userId: socket.id, commands });
  });

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
    delete userStrokes[userId];
    delete userConnections[userId];
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
