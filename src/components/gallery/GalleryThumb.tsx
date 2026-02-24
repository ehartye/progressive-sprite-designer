import type { ApprovedSprite } from '../../context/WorkflowContext';

interface Props {
  sprite: ApprovedSprite;
  onClick: () => void;
}

export default function GalleryThumb({ sprite, onClick }: Props) {
  const src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  const timeStr = new Date(sprite.timestamp).toLocaleTimeString();

  return (
    <div className="gallery-thumb" onClick={onClick}>
      <img src={src} className="gallery-thumb-img" alt={sprite.poseName} />
      <div className="gallery-thumb-info">
        <span className="gallery-thumb-name">{sprite.poseName}</span>
        <span className="gallery-thumb-time">{timeStr}</span>
      </div>
    </div>
  );
}
