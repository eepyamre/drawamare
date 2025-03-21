import SocketIO, { Server } from 'socket.io';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';

interface Stroke {
  id: string;
  points: number[];
  color: string; // corrected typo from 'colour' to 'color' to match client Stroke interface if needed, or adjust client to 'colour'
  thickness: number;
  stroke?: string; // Add stroke property to match Konva.Line attrs, and client-side Stroke type
}

interface StrokeEvent {
  // Define StrokeEvent interface to match client type if used
  userId: string;
  stroke: Stroke;
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

  // Assign unique username (could be replaced with auth)
  socket.username = `User ${uuidv4().substring(0, 5)}`;

  // Join room based on user ID - not really used in current setup
  socket.join(userId);
  userConnections[userId] = socket;

  // Send all existing strokes to the newly connected user
  const initialStrokes: StrokeEvent[] = [];
  for (const uId in userStrokes) {
    if (userStrokes.hasOwnProperty(uId)) {
      userStrokes[uId].forEach((stroke) => {
        initialStrokes.push({ userId: uId, stroke });
      });
    }
  }
  socket.emit('initialStrokes', initialStrokes);

  // Handle new strokes
  socket.on('drawStroke', (stroke: Stroke) => {
    if (!userStrokes[userId]) userStrokes[userId] = [];
    userStrokes[userId].push(stroke);

    // Broadcast to all except sender
    socket.broadcast.emit('newStroke', { userId, stroke });
  });

  // Handle undo requests
  socket.on('undo', () => {
    if (userStrokes[userId]?.length) {
      userStrokes[userId].pop();
      socket.broadcast.emit('strokeRemoved', { userId });
    }
  });

  socket.on('disconnect', () => {
    delete userStrokes[userId];
    delete userConnections[userId];
  });
});

httpServer.listen(3000, () => {
  console.log('Server running on port 3000');
});
