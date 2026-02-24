import { useState } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';

const ICONS = { pending: '\u25CB', current: '\u25C9', approved: '\u2713', skipped: '\u2014' };

export default function PoseTree() {
  const { state, jumpToPose } = useWorkflow();
  const { hierarchy, currentPhaseIndex, currentPoseIndex, approvedSprites, skippedPoseIds } = state;

  const approvedIds = new Set(approvedSprites.map(s => s.poseId));
  const skippedIds = new Set(skippedPoseIds);

  return (
    <div className="pose-tree">
      {hierarchy.map((phase, phaseIdx) => (
        <PhaseNode
          key={phase.id}
          phase={phase}
          phaseIdx={phaseIdx}
          isCurrent={phaseIdx === currentPhaseIndex}
          currentPoseIndex={currentPoseIndex}
          currentPhaseIndex={currentPhaseIndex}
          approvedIds={approvedIds}
          skippedIds={skippedIds}
          onPoseClick={jumpToPose}
        />
      ))}
    </div>
  );
}

interface PhaseNodeProps {
  phase: any;
  phaseIdx: number;
  isCurrent: boolean;
  currentPoseIndex: number;
  currentPhaseIndex: number;
  approvedIds: Set<string>;
  skippedIds: Set<string>;
  onPoseClick: (phaseIdx: number, poseIdx: number) => void;
}

function PhaseNode({ phase, phaseIdx, isCurrent, currentPoseIndex, currentPhaseIndex, approvedIds, skippedIds, onPoseClick }: PhaseNodeProps) {
  const [open, setOpen] = useState(isCurrent);

  return (
    <div className="pose-tree-phase">
      <div className="pose-tree-phase-header" onClick={() => setOpen(!open)}>
        <span className="chevron">{open ? '\u25BE' : '\u25B6'}</span> {phase.name}
      </div>
      {open && (
        <div className="pose-tree-pose-list">
          {phase.poses.map((pose: any, poseIdx: number) => {
            const isCurrentPose = phaseIdx === currentPhaseIndex && poseIdx === currentPoseIndex;
            let icon = ICONS.pending;
            let cls = 'pose-pending';

            if (isCurrentPose) { icon = ICONS.current; cls = 'pose-current'; }
            else if (approvedIds.has(pose.id)) { icon = ICONS.approved; cls = 'pose-approved'; }
            else if (skippedIds.has(pose.id)) { icon = ICONS.skipped; cls = 'pose-skipped'; }

            return (
              <div
                key={pose.id}
                className={`pose-tree-pose ${cls}`}
                onClick={e => { e.stopPropagation(); onPoseClick(phaseIdx, poseIdx); }}
              >
                <span className="pose-icon">{icon}</span> {pose.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
