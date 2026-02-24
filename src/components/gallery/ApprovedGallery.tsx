import { useState } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import GalleryThumb from './GalleryThumb';
import SpriteModal from './SpriteModal';
import type { ApprovedSprite } from '../../context/WorkflowContext';

export default function ApprovedGallery() {
  const { state, removeSprite } = useWorkflow();
  const [modalSprite, setModalSprite] = useState<ApprovedSprite | null>(null);

  if (state.approvedSprites.length === 0) {
    return <p className="empty-state-text">No approved sprites yet.</p>;
  }

  return (
    <div className="approved-gallery">
      {state.approvedSprites.map(sprite => (
        <GalleryThumb
          key={sprite.poseId}
          sprite={sprite}
          onClick={() => setModalSprite(sprite)}
        />
      ))}
      {modalSprite && (
        <SpriteModal
          sprite={modalSprite}
          onClose={() => setModalSprite(null)}
          onRemove={() => {
            removeSprite(modalSprite.poseId);
            setModalSprite(null);
          }}
        />
      )}
    </div>
  );
}
