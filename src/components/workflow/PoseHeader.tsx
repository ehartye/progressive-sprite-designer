import { useWorkflow } from '../../hooks/useWorkflow';

export default function PoseHeader() {
  const { state } = useWorkflow();

  if (!state.workflowActive) {
    return (
      <div className="pose-header">
        <p className="empty-state-text center-empty-state">
          Configure your character and start the workflow to begin generating sprites.
        </p>
      </div>
    );
  }

  const phase = state.hierarchy[state.currentPhaseIndex];
  const pose = phase?.poses[state.currentPoseIndex];

  if (!phase || !pose) return null;

  return (
    <div className="pose-header">
      <div className="pose-header-title">
        Phase {state.currentPhaseIndex + 1}/{state.hierarchy.length} &mdash; {phase.name}
        &nbsp;|&nbsp; Pose {state.currentPoseIndex + 1}/{phase.poses.length}: {pose.name}
      </div>
      {pose.description && <div className="pose-header-desc">{pose.description}</div>}
    </div>
  );
}
