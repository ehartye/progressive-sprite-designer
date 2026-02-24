import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ApprovedSprite } from '../../context/WorkflowContext';

const MODAL_SCALE = 8;

interface Props {
  sprite: ApprovedSprite;
  onClose: () => void;
  onRemove: () => void;
}

export default function SpriteModal({ sprite, onClose, onRemove }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const handler = () => {
      img.style.width = `${img.naturalWidth * MODAL_SCALE}px`;
      img.style.height = `${img.naturalHeight * MODAL_SCALE}px`;
    };
    img.addEventListener('load', handler);
    return () => img.removeEventListener('load', handler);
  }, [sprite]);

  const src = `data:${sprite.mimeType};base64,${sprite.imageData}`;
  const timeStr = new Date(sprite.timestamp).toLocaleString();

  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <div className="modal-sprite-container">
          <img ref={imgRef} src={src} className="modal-sprite-img sprite-image" alt={sprite.poseName} />
        </div>
        <div className="modal-info">
          <h3 className="modal-title">{sprite.poseName}</h3>
          <p className="modal-time">{timeStr}</p>
          <details className="modal-prompt-details">
            <summary>Prompt</summary>
            <pre className="modal-prompt-text">{sprite.prompt || 'N/A'}</pre>
          </details>
          <button className="btn btn-danger btn-sm modal-remove-btn" onClick={onRemove}>
            Remove from Approved
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
