import {
  FillGradient,
  Graphics,
  RenderTexture,
  Renderer,
  Sprite,
} from 'pixi.js';

import { BrushExtended, MAX_DOTS_AT_FULL_DENSITY, rotatePoint } from '../utils';

export class BrushEngine {
  static drawStamp(
    renderer: Renderer,
    brush: BrushExtended
  ): Sprite | Graphics | undefined {
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
    const vFade = brush?.vFade;
    const hFade = brush?.hFade;
    const angle = brush.angle || 0;

    const generateTipMask = (sprite: Sprite | Graphics) => {
      if (hFade || vFade) {
        const getGradientMask = (offset: number, maskAngle?: number) => {
          const combinedAngle = angle + (maskAngle || 0);
          offset = offset / 100;
          const gradient = new FillGradient({
            start: { x: 0, y: 0 },
            end: { x: 0, y: 1 },

            textureSpace: 'local',
            type: 'linear',
          });
          gradient.addColorStop(0, 0x000000);
          gradient.addColorStop(offset / 4, 0x000000);
          gradient.addColorStop(offset / 2, 0xffffff);
          gradient.addColorStop(0.5, 0xffffff);
          gradient.addColorStop(1 - offset / 2, 0xffffff);
          gradient.addColorStop(1 - offset / 4, 0x000000);
          gradient.addColorStop(1, 0x000000);
          const rect = new Graphics().rect(0, 0, width, height).fill(gradient);

          const gradientTexture = RenderTexture.create({
            width,
            height,
          });
          if (combinedAngle) {
            rect.angle = combinedAngle;
            rect.position.set(width / 2, height / 2);
            rect.pivot.set(width / 2, height / 2);
          }
          renderer.render({
            target: gradientTexture,
            container: rect,
          });

          const mask = new Sprite({
            width,
            height,
            texture: gradientTexture,
          });
          rect.destroy(true);
          gradient.destroy();
          return mask;
        };

        const vMask = getGradientMask(vFade);
        const hMask = getGradientMask(hFade, 90);
        const maskTexture = RenderTexture.create({
          width,
          height,
        });
        renderer.render({
          target: maskTexture,
          container: vMask,
        });
        const mask1 = new Sprite({
          width,
          height,
          texture: maskTexture,
        });
        mask1.mask = hMask;
        const mask2Texture = RenderTexture.create({
          width,
          height,
        });
        renderer.render({
          target: mask2Texture,
          container: mask1,
        });
        vMask.destroy(true);
        hMask.destroy(true);
        mask1.destroy(true);
        maskTexture.destroy(true);
        const mask = new Sprite({
          width,
          height,
          texture: mask2Texture,
        });
        sprite.addChild(mask);
        sprite.mask = mask;
      }
    };

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

    const globalRotation = (angle * Math.PI) / 180;

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
      generateTipMask(stampShape);
      return stampShape;
    }

    stampShape.fill(0xffffff);

    const dotsContainer = new Graphics();

    const boundingRadius = baseRadius * Math.max(1, ratio);

    const approximateStampArea = Math.PI * boundingRadius * boundingRadius;
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
    generateTipMask(sprite);
    dotsContainer.destroy(true);
    return sprite;
  }
}
