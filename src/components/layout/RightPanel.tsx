import ApprovedGallery from '../gallery/ApprovedGallery';
import { useWorkflow } from '../../hooks/useWorkflow';

export default function RightPanel() {
  const { state } = useWorkflow();

  const downloadAll = () => {
    for (const sprite of state.approvedSprites) {
      downloadBase64(sprite.imageData, sprite.mimeType, `${sprite.poseId}.png`);
    }
  };

  const downloadSheet = () => {
    const sprites = state.approvedSprites;
    if (sprites.length === 0) return;

    const images: HTMLImageElement[] = [];
    let loaded = 0;

    for (const sprite of sprites) {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === sprites.length) buildSpriteSheet(images);
      };
      img.src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
      images.push(img);
    }
  };

  return (
    <aside className="panel panel-right">
      <section className="panel-section">
        <h2 className="section-title">Approved Sprites</h2>
        <ApprovedGallery />
      </section>
      <section className="panel-section export-section">
        <h2 className="section-title">Export</h2>
        <button
          className="btn btn-secondary btn-full"
          disabled={state.approvedSprites.length === 0}
          onClick={downloadAll}
        >
          Download All Sprites
        </button>
        <button
          className="btn btn-secondary btn-full"
          disabled={state.approvedSprites.length === 0}
          onClick={downloadSheet}
        >
          Download Sprite Sheet
        </button>
      </section>
    </aside>
  );
}

function downloadBase64(data: string, mimeType: string, filename: string) {
  const byteChars = atob(data);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSpriteSheet(images: HTMLImageElement[]) {
  if (images.length === 0) return;
  const maxW = Math.max(...images.map(i => i.naturalWidth));
  const maxH = Math.max(...images.map(i => i.naturalHeight));
  const cols = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * maxW;
  canvas.height = rows * maxH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * maxW + Math.floor((maxW - img.naturalWidth) / 2);
    const y = row * maxH + Math.floor((maxH - img.naturalHeight) / 2);
    ctx.drawImage(img, x, y);
  });

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sprite_sheet.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
