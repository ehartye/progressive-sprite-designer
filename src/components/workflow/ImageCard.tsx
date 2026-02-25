import { useRef, useEffect } from 'react';
import type { GeneratedOption } from '../../context/WorkflowContext';

interface Props {
  option: GeneratedOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
}

export default function ImageCard({ option, index, isSelected, onSelect, onRegenerate }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dimRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const handler = () => {
      if (dimRef.current) dimRef.current.textContent = `${img.naturalWidth} x ${img.naturalHeight}`;
    };
    img.addEventListener('load', handler);
    return () => img.removeEventListener('load', handler);
  }, [option]);

  if (option.error) {
    return (
      <div className="image-card error-card">
        <div className="image-card-inner error-inner">
          <span className="error-icon">&#9888;</span>
          <span className="error-text">{option.error}</span>
        </div>
        <div className="image-card-meta"><span className="image-dim">Error</span></div>
      </div>
    );
  }

  if (!option.image) {
    return (
      <div className="image-card placeholder-card">
        <div className="image-card-inner shimmer" />
        <div className="image-card-meta"><span className="image-dim">--</span></div>
      </div>
    );
  }

  const src = `data:${option.image.mimeType};base64,${option.image.data}`;

  return (
    <div
      className={`image-card${isSelected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <div className="image-card-inner">
        <img ref={imgRef} src={src} className="sprite-image" alt={`Option ${index + 1}`} />
        <button
          className="regen-btn"
          title="Regenerate this image"
          onClick={e => { e.stopPropagation(); onRegenerate(); }}
        >
          &#8635;
        </button>
      </div>
      <div className="image-card-meta">
        <span ref={dimRef} className="image-dim">Loading...</span>
      </div>
    </div>
  );
}
