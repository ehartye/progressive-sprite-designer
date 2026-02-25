/**
 * Chroma-key (color removal) for sprite images.
 * Removes magenta/pink backgrounds by setting matching pixels to transparent.
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
 * Apply chroma-key removal to ImageData.
 * Pixels within `tolerance` Manhattan distance (sum of absolute differences) of the target color get alpha=0.
 *
 * Default target: #FF00FF (magenta) — the standard sprite sheet background.
 * Tolerance 0 = no removal. Tolerance 40 = reasonable default. Max ~128.
 */
export function applyChromaKey(
  source: ImageData,
  tolerance: number,
  keyR = 255,
  keyG = 0,
  keyB = 255,
): ImageData {
  if (tolerance <= 0) return source;

  const out = new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height,
  );
  const threshold = tolerance * 3; // sum-of-abs-differences threshold
  const data = out.data;

  for (let i = 0; i < data.length; i += 4) {
    const dist =
      Math.abs(data[i] - keyR) +
      Math.abs(data[i + 1] - keyG) +
      Math.abs(data[i + 2] - keyB);
    if (dist < threshold) {
      data[i + 3] = 0; // transparent
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
