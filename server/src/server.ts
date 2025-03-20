// server/src/server.ts
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

interface Layer {
  id: string;
  name: string;
}

interface LayerListUpdatePayload {
  layers: Layer[];
}

interface WebSocketWithId extends WebSocket {
  id: string;
}

type CreateLayerPayload = {
  id: string;
  name: string;
};

enum Events {
  CREATE_LAYER = 'createLayer',
  PING = 'ping',
}

type Message =
  | {
      type: Events.CREATE_LAYER;
      payload: CreateLayerPayload;
    }
  | {
      type: Events.PING;
    };

const DATA_FILE_PATH = './layers.json'; // Path to the JSON file for storing layers

let layers: Layer[] = [];

const loadLayersFromFile = () => {
  try {
    const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    layers = JSON.parse(rawData);
    console.log('Layers loaded from file.');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No layers.json file found, starting with empty layers.');
      layers = []; // Start with empty layers if file not found
    } else {
      console.error('Error loading layers from file:', error);
      layers = []; // Start with empty layers in case of error
    }
  }
};

loadLayersFromFile();

const saveLayersToFile = () => {
  try {
    const jsonData = JSON.stringify(layers, null, 2); // Pretty print JSON
    fs.writeFileSync(DATA_FILE_PATH, jsonData, 'utf-8');
    console.log('Layers saved to file.');
  } catch (error) {
    console.error('Error saving layers to file:', error);
  }
};

const wss = new WebSocketServer({ port: 8080 });

const broadcastLayerUpdate = () => {
  const payload: LayerListUpdatePayload = { layers };
  const message = JSON.stringify({ type: 'layerListUpdate', payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      (client as WebSocketWithId).send(message);
    }
  });
};

wss.on('connection', (ws) => {
  const clientWs = ws as WebSocketWithId;
  clientWs.id = uuidv4();
  console.log(`Client connected with ID: ${clientWs.id}`);

  clientWs.send(
    JSON.stringify({ type: 'layerListUpdate', payload: { layers } })
  );

  ws.on('message', (messageString) => {
    console.log(
      `Received message: ${messageString} from client ID: ${clientWs.id}`
    );
    try {
      const message: Message = JSON.parse(messageString.toString());
      switch (message.type) {
        case Events.PING:
          clientWs.send(JSON.stringify({ type: 'pong' }));
          break;
        case Events.CREATE_LAYER: {
          const payload = message.payload;
          const newLayer: Layer = {
            id: payload.id,
            name: payload.name,
          };
          layers = [...layers, newLayer];
          saveLayersToFile(); // Save layers to file after adding a new layer
          broadcastLayerUpdate();
          break;
        }

        default:
          console.log('Unknown message type:', (message as any).type);
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientWs.id}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientWs.id}: ${error}`);
  });
});

console.log('WebSocket server started on port 8080');
