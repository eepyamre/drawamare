import { useState, useEffect, useRef } from 'preact/compat';
import io from 'socket.io-client';
import Konva from 'konva';
import simplify from 'simplify-js';
import { Stroke, StrokeEvent } from '@/types';
import css from './styles.module.scss';

const socket = io('http://localhost:3000');

const simplifyPoints = (points: number[]) => {
  const pointsForSimplify = [];
  for (let i = 0; i < points.length; i += 2) {
    pointsForSimplify.push({
      x: points[i],
      y: points[i + 1],
    });
  }

  const tolerance = 1; // Experiment with tolerance value. Higher = more simplification.
  const simplifiedPoints = simplify(pointsForSimplify, tolerance, true);

  const newPoints = [];
  simplifiedPoints.forEach((point) => {
    newPoints.push(point.x, point.y);
  });
  return newPoints;
};

export const Home = () => {
  const [stage, setStage] = useState<Konva.Stage | null>();
  const [userId, setUserId] = useState<string | null>();

  const [userLayers, setUserLayers] = useState<{
    [userId: string]: Konva.Layer;
  }>({});

  const undoHistory = useRef<Konva.Line[]>([]);

  useEffect(() => {
    const stage = new Konva.Stage({
      container: 'canvas-container', // Matches the div ID
      width: 800,
      height: 600,
    });

    setStage(stage);

    socket.on('connect', () => {
      setUserId(socket.id);

      // Initialize user's own layer
      const myLayer = new Konva.Layer();
      stage.add(myLayer);
      setUserLayers((prev) => ({ ...prev, [socket.id]: myLayer }));

      undoHistory.current[socket.id] = [];
    });
  }, []);

  useEffect(() => {
    if (!stage) return;

    // Handle new strokes from others
    const handleNewStroke = (data: StrokeEvent) => {
      const { userId, stroke } = data;
      const layer = userLayers[userId] || addNewUserLayer(userId);
      const line = new Konva.Line(stroke);

      layer.add(line);
    };

    const handleStrokeRemoved = (data: { userId: string }) => {
      const { userId } = data;
      const layer = userLayers[userId];

      if (!layer) return;

      const lines = layer.find('Line') as Konva.Line[];
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        lastLine.remove();
      }
    };

    socket.on('initialStrokes', (initialStrokes: StrokeEvent[]) => {
      const tmp = userLayers;
      initialStrokes.forEach(({ userId, stroke }) => {
        if (!tmp[userId]) tmp[userId] = addNewUserLayer(userId);
        const layer = tmp[userId];
        const line = new Konva.Line(stroke);
        layer.add(line);
      });
    });

    socket.on('newStroke', handleNewStroke);

    socket.on('strokeRemoved', handleStrokeRemoved);

    // Cleanup
    return () => {
      socket.off('newStroke', handleNewStroke);
    };
  }, [stage, userLayers]);

  const addNewUserLayer = (userId: string) => {
    const newLayer = new Konva.Layer();
    stage.add(newLayer);
    setUserLayers((prev) => ({ ...prev, [userId]: newLayer }));
    return newLayer;
  };

  // Drawing logic
  useEffect(() => {
    if (!stage || !userId || !userLayers[userId]) return;
    const layer = userLayers[userId];

    let isDrawing = false;
    let lastLine: Konva.Line | null = null;

    const handleMouseDown = () => {
      isDrawing = true;
      const pos = stage.getPointerPosition();
      lastLine = new Konva.Line({
        stroke: '#000',
        strokeWidth: 5,
        points: [pos.x, pos.y, pos.x, pos.y],
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.5,
      });

      layer.add(lastLine);
    };

    const throttleInterval = 50; // ms throttle interval
    let lastSimplifyTime = 0;
    const handleMouseMove = () => {
      if (!isDrawing || !lastLine || !stage) return;
      const pos = stage.getPointerPosition();
      const newPoints = lastLine.points().concat([pos.x, pos.y]);
      lastLine.points(newPoints);

      const now = Date.now();
      if (now - lastSimplifyTime > throttleInterval) {
        console.log('hit');

        lastSimplifyTime = now;
        const simplifiedPreviewPoints = simplifyPoints(newPoints);
        lastLine.points(simplifiedPreviewPoints);
      }
    };

    const handleMouseUp = () => {
      if (!isDrawing) return;
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        ...lastLine.attrs,
      };

      const newPoints = simplifyPoints(lastLine.points());
      lastLine.points(newPoints);
      stroke.points = newPoints;

      socket.emit('drawStroke', stroke);
      isDrawing = false;
      lastLine = null;
      undoHistory.current = [];
    };

    const handleKeydown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    stage.on('mousedown', handleMouseDown);
    stage.on('mousemove', handleMouseMove);
    stage.on('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      stage.off('mousedown', handleMouseDown);
      stage.off('mousemove', handleMouseMove);
      stage.off('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [stage, userLayers, userId]);

  // Undo functionality
  const handleUndo = () => {
    if (!userId) return;
    const myLayer = userLayers[userId];
    if (!myLayer) return;
    const lines = myLayer.find('Line') as Konva.Line[];

    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      undoHistory.current.push(lastLine);
      lastLine.remove();
      socket.emit('undo');
    }
  };

  const handleRedo = () => {
    if (!userId) return;
    const myLayer = userLayers[userId];
    if (!myLayer) return;

    if (undoHistory.current.length > 0) {
      const lineToRedo = undoHistory.current.pop();

      if (lineToRedo) {
        myLayer.add(lineToRedo);

        const stroke: Stroke = {
          id: crypto.randomUUID(),
          ...lineToRedo.attrs,
        };

        socket.emit('drawStroke', stroke);
      }
    }
  };

  return (
    <div class={css.wrapper}>
      <div id='canvas-container' class={css.canvasContainer}></div>
      <button onClick={handleUndo}>Undo</button>
      <button onClick={handleRedo}>Redo</button>
    </div>
  );
};
