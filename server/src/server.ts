import SocketIO, { Server } from 'socket.io';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

interface Stroke {
  id: string;
  points: number[];
  color: string;
  thickness: number;
}

type Socket = SocketIO.Socket & {
  username?: string;
};

const httpServer = http.createServer();
const io = new Server(httpServer);

// Track user layers and connections
const userLayers: { [userId: string]: Stroke[] } = {};
const userConnections: { [userId: string]: Socket } = {};

io.on('connection', (socket: Socket) => {
  const userId = socket.id;

  // Assign unique username (could be replaced with auth)
  socket.username = `User ${uuidv4().substring(0, 5)}`;

  // Join room based on user ID
  socket.join(userId);

  // Handle new strokes
  socket.on('drawStroke', (stroke: Stroke) => {
    if (!userLayers[userId]) userLayers[userId] = [];
    userLayers[userId].push(stroke);

    // Broadcast to all except sender
    socket.broadcast.emit('newStroke', { userId, stroke });
  });

  // Handle undo requests
  socket.on('undo', () => {
    if (userLayers[userId]?.length) {
      userLayers[userId].pop();
      socket.broadcast.emit('strokeRemoved', { userId });
    }
  });

  socket.on('disconnect', () => {
    delete userLayers[userId];
    delete userConnections[userId];
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
