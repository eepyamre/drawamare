// TODO: FADE
import { BrushExtended, MAX_DOTS_AT_FULL_DENSITY, rotatePoint } from '../utils';
import { BrushController } from './brush';
import {
  Application,
  Graphics,
  Renderer,
  RenderTexture,
  Sprite,
} from 'pixi.js';

export class BrushEngine {
  app: Application | null = null;
  stampEl: HTMLDivElement;
  saveBtn: HTMLButtonElement;

  ratio: number = 1;
  spikes: number = 12;
  density: number = 100;
  spacing: number = 1;
  angle: number = 0;
  shape: 'square' | 'circle' = 'circle';
  constructor(editorRoot: string, brushCtr: BrushController) {
    const rootEl = document.querySelector<HTMLDivElement>(editorRoot);
    if (!rootEl) {
      throw new Error('No editor node');
    }

    const stampEl = rootEl.querySelector<HTMLDivElement>('.brush-stamp');
    const ratioEl = rootEl.querySelector<HTMLLabelElement>('#ratio');
    const spikesEl = rootEl.querySelector<HTMLLabelElement>('#spikes');
    const densityEl = rootEl.querySelector<HTMLLabelElement>('#density');
    const spacingEl = rootEl.querySelector<HTMLLabelElement>('#spacing');
    const angleEl = rootEl.querySelector<HTMLLabelElement>('#angle');
    const circleBtn = rootEl.querySelector<HTMLLabelElement>('#circle-btn');
    const squareBtn = rootEl.querySelector<HTMLLabelElement>('#square-btn');

    const saveBtn =
      rootEl.querySelector<HTMLButtonElement>('#brush-editor_save');
    if (
      [
        stampEl,
        saveBtn,
        ratioEl,
        spacingEl,
        spikesEl,
        densityEl,
        angleEl,
        circleBtn,
        squareBtn,
      ].some((item) => item === null)
    ) {
      throw new Error('Invalid node layout');
    }
    this.stampEl = stampEl!;
    this.saveBtn = saveBtn!;

    this.saveBtn.addEventListener('click', () => {
      brushCtr.setBrush({
        angle: this.angle,
        density: this.density,
        ratio: this.ratio,
        spacing: this.spacing,
        spikes: this.spikes,
        shape: this.shape,
      });
    });

    circleBtn?.addEventListener('click', () => {
      this.shape = 'circle';
      this.drawStampEditor();
    });
    squareBtn?.addEventListener('click', () => {
      this.shape = 'square';
      this.drawStampEditor();
    });

    this.pixiInit().then(() => {
      this.initInput(ratioEl!, 'ratio');
      this.initInput(spacingEl!, 'spacing');
      this.initInput(spikesEl!, 'spikes');
      this.initInput(densityEl!, 'density');
      this.initInput(angleEl!, 'angle');
    });
  }

  initInput(
    element: HTMLLabelElement,
    key: 'ratio' | 'spikes' | 'density' | 'spacing' | 'angle'
  ) {
    const input = element.querySelector('input');
    const span = element.querySelector('span');

    if (!input || !span) {
      throw new Error('Invalid input layout');
    }

    input.addEventListener('input', (e) => {
      const value = (e.currentTarget as HTMLInputElement)!.value;
      span.textContent = value;
      this[key] = Number(value);
      this.drawStampEditor();
    });

    span.textContent = input.value = String(this[key]);
    this.drawStampEditor();
  }

  async pixiInit() {
    this.app = new Application();

    await this.app.init({
      background: '#ccc',
      antialias: true,
      width: 150,
      height: 150,
    });

    this.stampEl.appendChild(this.app.canvas);
  }

  drawStampEditor() {
    const stage = this.app?.stage;
    if (!stage) {
      throw new Error('No stage!');
    }
    stage.removeChildren();
    const stamp = BrushEngine.drawStamp(this.app?.renderer!, this);
    if (stamp) stage.addChild(stamp);
  }

  static drawStamp(renderer: Renderer, brush: BrushExtended) {
    if (brush.density <= 0) {
      return;
    }

    const color = brush?.color ?? 0x000000;
    const width = brush?.size ? brush?.size * 2 : 150;
    const height = brush?.size ? brush?.size * 2 : 150;
    const centerX = width / 2;
    const centerY = height / 2;

    const stampShape = new Graphics();

    const baseRadius = brush?.size ? brush?.size / 2 : 50;
    const spikeCount = brush?.spikes;
    const ratio = brush?.ratio;
    const density = brush?.density;

    const cx = centerX;
    const cy = centerY;
    const rx = baseRadius;
    const ry = baseRadius * ratio;

    const K = 0.5522847498307936;

    const P0 = { x: cx, y: cy + ry };
    const CP1 = { x: cx + K * rx, y: cy + ry };
    const CP2 = { x: cx + rx, y: cy + K * ry };
    const P1 = { x: cx + rx, y: cy };
    const CP3 = { x: cx + rx, y: cy - K * ry };
    const CP4 = { x: cx + K * rx, y: cy - ry };
    const P2 = { x: cx, y: cy - ry };

    const globalRotation = ((brush.angle || 0) * Math.PI) / 180;

    for (let i = 0; i < spikeCount; i++) {
      if (brush.shape === 'circle') {
        const theta = (2 * Math.PI * i) / spikeCount + globalRotation;

        const rP0 = rotatePoint(P0.x, P0.y, theta, cx, cy);
        const rCP1 = rotatePoint(CP1.x, CP1.y, theta, cx, cy);
        const rCP2 = rotatePoint(CP2.x, CP2.y, theta, cx, cy);
        const rP1 = rotatePoint(P1.x, P1.y, theta, cx, cy);
        const rCP3 = rotatePoint(CP3.x, CP3.y, theta, cx, cy);
        const rCP4 = rotatePoint(CP4.x, CP4.y, theta, cx, cy);
        const rP2 = rotatePoint(P2.x, P2.y, theta, cx, cy);

        stampShape.moveTo(cx, cy);
        stampShape.lineTo(rP0.x, rP0.y);
        stampShape.bezierCurveTo(rCP1.x, rCP1.y, rCP2.x, rCP2.y, rP1.x, rP1.y);
        stampShape.bezierCurveTo(rCP3.x, rCP3.y, rCP4.x, rCP4.y, rP2.x, rP2.y);
        stampShape.lineTo(cx, cy);
      } else {
        const theta = (2 * Math.PI * i) / spikeCount + globalRotation;

        const ux = Math.cos(theta);
        const uy = Math.sin(theta);
        const px = -uy;
        const py = ux;

        const innerR = 0;
        const outerR = rx;

        const halfWidth = Math.max(3, rx * 0.25) * ratio;

        const p1x = cx + innerR * ux + halfWidth * px;
        const p1y = cy + innerR * uy + halfWidth * py;

        const p2x = cx + outerR * ux + halfWidth * px;
        const p2y = cy + outerR * uy + halfWidth * py;

        const p3x = cx + outerR * ux - halfWidth * px;
        const p3y = cy + outerR * uy - halfWidth * py;

        const p4x = cx + innerR * ux - halfWidth * px;
        const p4y = cy + innerR * uy - halfWidth * py;

        stampShape.moveTo(p1x, p1y);
        stampShape.lineTo(p2x, p2y);
        stampShape.lineTo(p3x, p3y);
        stampShape.lineTo(p4x, p4y);
        stampShape.lineTo(p1x, p1y);
      }
    }

    if (density >= 100) {
      stampShape.fill(color);

      return stampShape;
    }

    stampShape.fill(0xffffff);

    const dotsContainer = new Graphics();

    const boundingRadius = baseRadius * Math.max(1, ratio);

    const approximateStampArea = Math.PI * boundingRadius * boundingRadius;
    // TODO: make MAX_DOTS_AT_FULL_DENSITY a parameter
    const singleDotArea = (approximateStampArea / MAX_DOTS_AT_FULL_DENSITY) * 2;
    const dotRadius = Math.sqrt(singleDotArea / Math.PI);
    const numDots = Math.floor(MAX_DOTS_AT_FULL_DENSITY * (density / 100));

    for (let i = 0; i < numDots; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.sqrt(Math.random()) * boundingRadius;

      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      dotsContainer.circle(x, y, dotRadius).fill(color);
    }
    dotsContainer.addChild(stampShape);
    dotsContainer.mask = stampShape;

    const rt = RenderTexture.create({
      width,
      height,
    });
    renderer.render({
      container: dotsContainer,
      target: rt,
    });

    const sprite = new Sprite({
      texture: rt,
    });
    dotsContainer.destroy(true);
    return sprite;
  }
}
