import { useWorkflow } from '../../hooks/useWorkflow';

export default function ActionBar() {
  const { state, generate, approve, skip, nextPose, prevPose } = useWorkflow();
  const hasSelection = state.selectedIndex >= 0;
  const hasApproved = state.approvedSprites.some(
    s => s.poseId === state.hierarchy[state.currentPhaseIndex]?.poses[state.currentPoseIndex]?.id
  );

  return (
    <div className="action-bar">
      <button className="btn btn-secondary" onClick={prevPose} disabled={!state.workflowActive}>
        &larr; Previous Pose
      </button>
      <button className="btn btn-primary" onClick={generate} disabled={!state.workflowActive || state.isGenerating}>
        {state.isGenerating ? 'Generating...' : 'Generate'}
      </button>
      <button className="btn btn-success" onClick={approve} disabled={!hasSelection}>
        Approve Selected
      </button>
      <button className="btn btn-secondary" onClick={skip} disabled={!state.workflowActive || state.isGenerating}>
        Skip Pose
      </button>
      <button className="btn btn-secondary" onClick={nextPose} disabled={!state.workflowActive || !hasApproved}>
        Next Pose &rarr;
      </button>
    </div>
  );
}
