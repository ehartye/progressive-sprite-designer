import { useWorkflow } from '../../hooks/useWorkflow';

export default function ProgressBar() {
  const { state } = useWorkflow();
  const completed = state.approvedSprites.length + state.skippedPoseIds.length;
  const total = state.totalPoses;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">{completed} / {total} poses</span>
    </div>
  );
}
