/**
 * Chroma-key (color removal) for sprite images.
 * Removes magenta/pink backgrounds using soft alpha blending
 * to avoid pink fringing and holes in sprites.
 */

/**
 * Convert a bare base64 string + mimeType to ImageData via an offscreen canvas.
 */
export function base64ToImageData(
  base64: string,
  mimeType: string,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error('Failed to decode image for chroma key'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/**
 * Apply chroma-key removal to ImageData with soft alpha edges.
 *
 * Uses two thresholds:
 *   - Core threshold (scales with tolerance): pixels within this distance
 *     from the key color become fully transparent.
 *   - Soft edge (fixed 60-unit band beyond core): alpha ramps linearly
 *     from 0 to full, giving smooth anti-aliased edges without darkening
 *     the rest of the sprite.
 *
 * No color despill is applied — the soft alpha naturally fades out the
 * key color contribution at edges, which looks correct when composited
 * over any background.
 *
 * Default target: #FF00FF (magenta) — the standard sprite sheet background.
 * Tolerance 0 = no removal. Higher values remove more aggressively.
 */
export function applyChromaKey(
  source: ImageData,
  tolerance: number,
  keyR = 255,
  keyG = 0,
  keyB = 255,
): ImageData {
  if (tolerance <= 0) return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );

  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const data = out.data;

  // Core threshold scales with tolerance: pixels within this are fully removed.
  // Soft edge is a fixed-width band beyond the core — narrow enough to only
  // affect the actual anti-aliased boundary pixels, not the sprite body.
  const coreThreshold = tolerance * 3;
  const SOFT_EDGE_WIDTH = 60;
  const outerThreshold = coreThreshold + SOFT_EDGE_WIDTH;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const dist =
      Math.abs(data[i] - keyR) +
      Math.abs(data[i + 1] - keyG) +
      Math.abs(data[i + 2] - keyB);

    if (dist < coreThreshold) {
      data[i + 3] = 0;
    } else if (dist < outerThreshold) {
      // Soft edge: linear ramp from transparent to original alpha
      const t = (dist - coreThreshold) / SOFT_EDGE_WIDTH;
      data[i + 3] = Math.round(t * a);
    }
  }

  return out;
}

/**
 * Convert ImageData back to an HTMLImageElement for canvas drawing.
 */
export function imageDataToImage(imageData: ImageData): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to convert ImageData to Image'));
    img.src = canvas.toDataURL('image/png');
  });
}
