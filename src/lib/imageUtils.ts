/**
 * Downscale a base64-encoded image to fit within maxDim x maxDim pixels.
 * Uses nearest-neighbor interpolation to preserve pixel art crispness.
 * Returns a base64 string (no data URL prefix) and mime type.
 */
export function downsampleImage(
  base64: string,
  mimeType: string,
  maxDim: number
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve({ data: base64, mimeType });
        return;
      }

      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        data: dataUrl.replace(/^data:image\/png;base64,/, ''),
        mimeType: 'image/png',
      });
    };
    img.onerror = () => reject(new Error('Failed to load image for resizing'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/**
 * Flip a base64-encoded image horizontally (mirror).
 * Returns a new base64 string (no data URL prefix) and mime type.
 */
export function flipImageHorizontal(
  base64: string,
  mimeType: string
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        data: dataUrl.replace(/^data:image\/png;base64,/, ''),
        mimeType: 'image/png',
      });
    };
    img.onerror = () => reject(new Error('Failed to load image for flip'));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}
