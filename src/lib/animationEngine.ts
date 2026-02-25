/**
 * AnimationEngine — pure TypeScript class that manages the sprite animation
 * preview canvas. Held in a useRef; never in React state.
 *
 * Responsibilities:
 *   - requestAnimationFrame render loop
 *   - Path script state machine (character position + current animGroup)
 *   - Frame timing (msPerFrame per animGroup)
 *   - Per-frame transform adjustments (dx, dy, scaleX, scaleY)
 *   - Drawing chroma-keyed sprites onto the preview canvas
 */

import type { PathScript, PathStep } from './pathScripts';

export interface FrameAdjust {
  dx: number;      // pixel offset, range [-16, 16]
  dy: number;
  scaleX: number;  // multiplier, range [0.5, 2.0]
  scaleY: number;
}

export const DEFAULT_FRAME_ADJUST: FrameAdjust = {
  dx: 0,
  dy: 0,
  scaleX: 1,
  scaleY: 1,
};

export interface AnimFrame {
  poseId: string;
  animGroup: string;
  frameIndex: number;
}

export class AnimationEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Sprite data
  private groupedFrames: Map<string, AnimFrame[]> = new Map();
  private images: Map<string, HTMLImageElement> = new Map(); // poseId → loaded img
  private processedImages: Map<string, HTMLImageElement> = new Map(); // chroma-keyed

  // Frame adjustments
  private adjustments: Map<string, FrameAdjust> = new Map();

  // Timing
  private msPerFrame: Map<string, number> = new Map();
  private loopGroups: Set<string> = new Set();

  // Path script state
  private script: PathScript | null = null;
  private scriptStepIndex = 0;
  private stepElapsed = 0;

  // Character position (canvas pixels)
  private charX = 0;
  private charY = 0;

  // Animation state
  private frameElapsed = 0;
  private currentFrameIndex = 0;

  // RAF
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private playing = false;

  // Display
  private zoom = 4;
  private spriteW = 16;
  private spriteH = 24;

  // Onion skin
  private onionSkinEnabled = false;
  private onionSkinOpacity = 0.3;

  constructor(canvas: HTMLCanvasElement, spriteW = 16, spriteH = 24) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.spriteW = spriteW;
    this.spriteH = spriteH;
    this.resetCharToCenter();
  }

  // --- Data setters (called by hook, no re-renders) ---

  setGroupedFrames(groups: Map<string, AnimFrame[]>): void {
    this.groupedFrames = groups;
  }

  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images;
  }

  setProcessedImages(images: Map<string, HTMLImageElement>): void {
    this.processedImages = images;
  }

  setAdjustments(adj: Map<string, FrameAdjust>): void {
    this.adjustments = adj;
  }

  setMsPerFrame(map: Map<string, number>): void {
    this.msPerFrame = map;
  }

  setLoopGroups(loops: Set<string>): void {
    this.loopGroups = loops;
  }

  setPathScript(script: PathScript | null): void {
    this.script = script;
    this.scriptStepIndex = 0;
    this.stepElapsed = 0;
    this.frameElapsed = 0;
    this.currentFrameIndex = 0;
    this.resetCharToCenter();
  }

  setZoom(z: number): void {
    this.zoom = z;
    this.ctx.imageSmoothingEnabled = false;
    this.resetCharToCenter();
  }

  setOnionSkin(enabled: boolean, opacity: number): void {
    this.onionSkinEnabled = enabled;
    this.onionSkinOpacity = opacity;
  }

  // --- Loop control ---

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTimestamp = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.playing = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stop();
    // Reassign instead of .clear() to avoid mutating shared Map references
    this.images = new Map();
    this.processedImages = new Map();
    this.groupedFrames = new Map();
    this.adjustments = new Map();
  }

  /** Render a single static frame (when paused) */
  renderStatic(animGroup: string): void {
    const frames = this.groupedFrames.get(animGroup);
    if (!frames || frames.length === 0) {
      this.drawBackground();
      this.drawEmptyOverlay();
      return;
    }
    this.drawBackground();
    const frameIndex = Math.min(this.currentFrameIndex, frames.length - 1);
    this.drawFrame(frames[frameIndex], this.canvas.width / 2, this.canvas.height / 2);
  }

  // --- Private ---

  private tick = (timestamp: number): void => {
    if (!this.playing) return;

    if (this.lastTimestamp === 0) this.lastTimestamp = timestamp;
    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    if (!this.script || this.script.steps.length === 0) {
      // No script — just advance frame timing for the first available group
      this.advanceFrameTiming(dt, this.getFirstGroup());
      return;
    }

    const step = this.script.steps[this.scriptStepIndex];
    this.stepElapsed += dt;

    // Move character
    this.charX += step.moveX * dt;
    this.charY += step.moveY * dt;

    // Clamp to canvas bounds
    const margin = this.spriteW * this.zoom;
    this.charX = Math.max(margin, Math.min(this.canvas.width - margin, this.charX));
    this.charY = Math.max(margin, Math.min(this.canvas.height - margin, this.charY));

    // Advance script step
    if (this.stepElapsed >= step.durationMs) {
      this.stepElapsed -= step.durationMs;
      this.scriptStepIndex = (this.scriptStepIndex + 1) % this.script.steps.length;
      this.frameElapsed = 0;
      this.currentFrameIndex = 0;

      // On wrap-around, reset character to center
      if (this.scriptStepIndex === 0) {
        this.resetCharToCenter();
      }
    }

    // Advance frame timing for current animGroup
    const currentAnimGroup = step.animGroup;
    this.advanceFrameTiming(dt, currentAnimGroup);
  }

  private advanceFrameTiming(dt: number, animGroup: string | null): void {
    if (!animGroup) return;

    const frames = this.groupedFrames.get(animGroup);
    if (!frames || frames.length === 0) return;

    const ms = this.msPerFrame.get(animGroup) ?? 500;
    this.frameElapsed += dt;

    if (this.frameElapsed >= ms) {
      this.frameElapsed -= ms;
      const isLoop = this.loopGroups.has(animGroup);

      if (isLoop) {
        this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
      } else {
        // One-shot: advance until last frame, then hold
        if (this.currentFrameIndex < frames.length - 1) {
          this.currentFrameIndex++;
        }
      }
    }
  }

  private render(): void {
    this.drawBackground();

    // Determine current animGroup and frame
    let animGroup: string | null = null;
    if (this.script && this.script.steps.length > 0) {
      animGroup = this.script.steps[this.scriptStepIndex].animGroup;
    } else {
      animGroup = this.getFirstGroup();
    }

    if (!animGroup) {
      this.drawEmptyOverlay();
      return;
    }

    const frames = this.groupedFrames.get(animGroup);
    if (!frames || frames.length === 0) return;

    const frameIndex = Math.min(this.currentFrameIndex, frames.length - 1);
    const frame = frames[frameIndex];

    const x = this.script ? this.charX : this.canvas.width / 2;
    const y = this.script ? this.charY : this.canvas.height / 2;

    // Onion skin: draw previous frame at reduced opacity
    if (this.onionSkinEnabled && frameIndex > 0) {
      this.ctx.globalAlpha = this.onionSkinOpacity;
      this.drawFrame(frames[frameIndex - 1], x, y);
      this.ctx.globalAlpha = 1;
    }

    // Current frame
    this.drawFrame(frame, x, y);

    // Onion skin: draw next frame at lower opacity
    if (this.onionSkinEnabled && frameIndex < frames.length - 1) {
      this.ctx.globalAlpha = this.onionSkinOpacity * 0.5;
      this.drawFrame(frames[frameIndex + 1], x, y);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawFrame(frame: AnimFrame, cx: number, cy: number): void {
    const ctx = this.ctx;
    const adj = this.adjustments.get(frame.poseId) ?? DEFAULT_FRAME_ADJUST;

    // Prefer chroma-keyed image, fall back to original
    const img = this.processedImages.get(frame.poseId) ?? this.images.get(frame.poseId);
    if (!img) return;

    // Fit image within the target box while preserving its native aspect ratio
    const imgW = img.naturalWidth || this.spriteW;
    const imgH = img.naturalHeight || this.spriteH;
    const spriteScale = 2; // render sprites 2x larger within the stage
    const targetW = this.spriteW * this.zoom * spriteScale;
    const targetH = this.spriteH * this.zoom * spriteScale;
    const fitScale = Math.min(targetW / imgW, targetH / imgH);
    const w = imgW * fitScale * adj.scaleX;
    const h = imgH * fitScale * adj.scaleY;
    const dx = adj.dx * this.zoom * spriteScale;
    const dy = adj.dy * this.zoom * spriteScale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx + dx, cy + dy);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark background
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, 0, w, h);

    // Subtle checkerboard
    const size = 16;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }

  private drawEmptyOverlay(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No frames available', this.canvas.width / 2, this.canvas.height / 2);
  }

  private resetCharToCenter(): void {
    this.charX = this.canvas.width / 2;
    this.charY = this.canvas.height / 2;
  }

  private getFirstGroup(): string | null {
    const keys = Array.from(this.groupedFrames.keys());
    return keys.length > 0 ? keys[0] : null;
  }
}
