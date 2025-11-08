import { MAX_DOTS_AT_FULL_DENSITY } from '../utils';
import { Application, Graphics } from 'pixi.js';

export class BrushEngine {
  app: Application | null = null;
  stampEl: HTMLDivElement;

  ratio: number = 1;
  spikes: number = 12;
  density: number = 100;
  spacing: number = 1;
  angle: number = 0;
  constructor(editorRoot: string) {
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

    if (
      [stampEl, ratioEl, spacingEl, spikesEl, densityEl, angleEl].some(
        (item) => item === null
      )
    ) {
      throw new Error('Invalid node layout');
    }
    this.stampEl = stampEl!;

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
      this.drawStamp();
      this.drawStamp();
    });

    span.textContent = input.value = String(this[key]);
    this.drawStamp();
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

  drawStamp() {
    const stage = this.app?.stage;
    if (!stage) {
      throw new Error('No stage!');
    }
    stage.removeChildren();

    if (this.density <= 0) {
      return;
    }

    const width = 150;
    const height = 150;
    const centerX = width / 2;
    const centerY = height / 2;

    const stampShape = new Graphics();

    const baseRadius = 50;
    const spikeCount = this.spikes;
    const ratio = this.ratio;
    const color = 0x000000;

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

    const rotatePoint = (px: number, py: number, angle: number) => {
      const dx = px - cx;
      const dy = py - cy;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      return {
        x: cx + dx * cosA - dy * sinA,
        y: cy + dx * sinA + dy * cosA,
      };
    };

    const globalRotation = ((this.angle || 0) * Math.PI) / 180;

    for (let i = 0; i < spikeCount; i++) {
      const theta = (2 * Math.PI * i) / spikeCount + globalRotation;

      const rP0 = rotatePoint(P0.x, P0.y, theta);
      const rCP1 = rotatePoint(CP1.x, CP1.y, theta);
      const rCP2 = rotatePoint(CP2.x, CP2.y, theta);
      const rP1 = rotatePoint(P1.x, P1.y, theta);
      const rCP3 = rotatePoint(CP3.x, CP3.y, theta);
      const rCP4 = rotatePoint(CP4.x, CP4.y, theta);
      const rP2 = rotatePoint(P2.x, P2.y, theta);

      stampShape.moveTo(cx, cy);
      stampShape.lineTo(rP0.x, rP0.y);
      stampShape.bezierCurveTo(rCP1.x, rCP1.y, rCP2.x, rCP2.y, rP1.x, rP1.y);
      stampShape.bezierCurveTo(rCP3.x, rCP3.y, rCP4.x, rCP4.y, rP2.x, rP2.y);
      stampShape.lineTo(cx, cy);
    }

    if (this.density >= 100) {
      stampShape.fill(color);
      stage.addChild(stampShape);
    } else {
      stampShape.fill(0xffffff);
      stage.addChild(stampShape);

      const dotsContainer = new Graphics();

      const boundingRadius = baseRadius * Math.max(1, this.ratio);

      const approximateStampArea = Math.PI * boundingRadius * boundingRadius;
      const singleDotArea =
        (approximateStampArea / MAX_DOTS_AT_FULL_DENSITY) * 2;
      const dotRadius = Math.sqrt(singleDotArea / Math.PI);
      const numDots = Math.floor(
        MAX_DOTS_AT_FULL_DENSITY * (this.density / 100)
      );

      for (let i = 0; i < numDots; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.sqrt(Math.random()) * boundingRadius;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        dotsContainer.circle(x, y, dotRadius).fill(color);
      }

      dotsContainer.mask = stampShape;
      stage.addChild(dotsContainer);
    }
  }
}
