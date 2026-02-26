import type { ApprovedSprite } from '../../context/WorkflowContext';

interface Props {
  sprites: ApprovedSprite[];
  onSelect: (poseId: string) => void;
  onClose: () => void;
}

export default function CopyPosePicker({ sprites, onSelect, onClose }: Props) {
  return (
    <div className="copy-picker-overlay" onClick={onClose}>
      <div className="copy-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="copy-picker-header">
          <span>Copy from approved sprite</span>
          <button className="copy-picker-close" onClick={onClose}>&times;</button>
        </div>
        <div className="copy-picker-grid">
          {sprites.map(sprite => (
            <div
              key={sprite.poseId}
              className="copy-picker-item"
              onClick={() => onSelect(sprite.poseId)}
            >
              <img
                src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                alt={sprite.poseName}
                className="copy-picker-thumb"
              />
              <span className="copy-picker-label">{sprite.poseName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
