import { Application, Graphics } from 'pixi.js';

(async () => {
  const app = new Application();

  await app.init({
    background: '#1099bb',
    resizeTo: window,
    antialias: true,
  });

  document.getElementById('pixi-container')!.appendChild(app.canvas);

  let obj = new Graphics();
  obj.strokeStyle.width = 10;
  obj.strokeStyle.cap = 'round';
  app.stage.addChild(obj);

  let drawing = false;
  app.canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    drawing = true;
    const stageScale = app.stage.scale.x;
    obj.moveTo(e.clientX / stageScale, e.clientY / stageScale);
  });

  app.canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const stageScale = app.stage.scale.x;
    obj.lineTo(e.clientX / stageScale, e.clientY / stageScale);
    obj.stroke();
  });

  app.canvas.addEventListener('mouseup', () => {
    drawing = false;
  });

  app.canvas.addEventListener('wheel', (e) => {
    const y = e.deltaY > 0 ? -0.1 : 0.1;
    app.stage.scale = app.stage.scale.x + y;
    if (app.stage.scale.x < 0.1) app.stage.scale = 0.1; // Prevent inverting or too small scale
  });
})();
