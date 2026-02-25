/** Draw an image scaled to fit within the given dimensions, centered, preserving aspect ratio. */
export function drawImageFitCenter(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
): void {
  const scale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (canvasW - w) / 2, (canvasH - h) / 2, w, h);
}

/**
 * Set up a canvas for HiDPI rendering.
 * Sets the canvas buffer to cssSize * devicePixelRatio and scales the context,
 * so drawing code can use CSS-pixel coordinates.
 * Returns the DPR used.
 */
export function setupHiDpiCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): number {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return dpr;
}
