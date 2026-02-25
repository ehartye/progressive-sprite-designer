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
