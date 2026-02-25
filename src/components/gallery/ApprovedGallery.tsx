import { useMemo } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import GalleryThumb from './GalleryThumb';

export default function ApprovedGallery() {
  const { state, jumpToPose } = useWorkflow();

  // Build a pose-order index from the hierarchy so we can sort approved sprites
  const poseOrder = useMemo(() => {
    const order = new Map<string, number>();
    let idx = 0;
    for (const phase of state.hierarchy) {
      for (const pose of phase.poses) {
        order.set(pose.id, idx++);
      }
    }
    return order;
  }, [state.hierarchy]);

  const sorted = useMemo(() =>
    [...state.approvedSprites].sort(
      (a, b) => (poseOrder.get(a.poseId) ?? 0) - (poseOrder.get(b.poseId) ?? 0)
    ),
    [state.approvedSprites, poseOrder],
  );

  if (sorted.length === 0) {
    return <p className="empty-state-text">No approved sprites yet.</p>;
  }

  const handleClick = (poseId: string) => {
    // Find the phase/pose indices for this poseId and navigate there
    for (let ph = 0; ph < state.hierarchy.length; ph++) {
      const phase = state.hierarchy[ph];
      for (let pi = 0; pi < phase.poses.length; pi++) {
        if (phase.poses[pi].id === poseId) {
          jumpToPose(ph, pi);
          return;
        }
      }
    }
  };

  return (
    <div className="approved-gallery">
      {sorted.map(sprite => (
        <GalleryThumb
          key={sprite.poseId}
          sprite={sprite}
          onClick={() => handleClick(sprite.poseId)}
        />
      ))}
    </div>
  );
}
