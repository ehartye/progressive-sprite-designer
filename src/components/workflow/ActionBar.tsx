import { useState } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import CopyPosePicker from './CopyPosePicker';

export default function ActionBar() {
  const { state, generate, approve, skip, nextPose, prevPose, setGenerationCount, flipApproved, copyFromSprite } = useWorkflow();
  const [showCopyPicker, setShowCopyPicker] = useState(false);

  const hasSelection = state.selectedIndex >= 0;
  const hasApproved = state.approvedSprites.some(
    s => s.poseId === state.hierarchy[state.currentPhaseIndex]?.poses[state.currentPoseIndex]?.id
  );
  const currentPoseId = state.hierarchy[state.currentPhaseIndex]?.poses[state.currentPoseIndex]?.id;
  const isCurrentPoseApproved = hasApproved;
  const isCurrentPoseEmpty = !isCurrentPoseApproved && !state.skippedPoseIds.includes(currentPoseId ?? '');

  return (
    <div className="action-bar">
      <button className="btn btn-secondary" onClick={prevPose} disabled={!state.workflowActive}>
        &larr; Previous Pose
      </button>

      {/* Generation count selector */}
      <div className="gen-count-selector">
        {[1, 2, 3, 4].map(n => (
          <button
            key={n}
            className={`gen-count-btn${state.generationCount === n ? ' gen-count-active' : ''}`}
            onClick={() => setGenerationCount(n)}
            title={`Generate ${n} option(s)`}
          >
            {n}
          </button>
        ))}
      </div>

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

      {/* Copy From button — visible when current pose is empty and there are approved sprites */}
      {isCurrentPoseEmpty && state.approvedSprites.length > 0 && (
        <button
          className="btn btn-secondary"
          onClick={() => setShowCopyPicker(true)}
          disabled={!state.workflowActive}
        >
          Copy From...
        </button>
      )}

      {/* Flip button — visible when current pose is approved */}
      {isCurrentPoseApproved && currentPoseId && (
        <button
          className="btn btn-secondary"
          onClick={() => flipApproved(currentPoseId)}
          disabled={!state.workflowActive}
        >
          Flip &#8596;
        </button>
      )}

      {/* Copy pose picker modal */}
      {showCopyPicker && (
        <CopyPosePicker
          sprites={state.approvedSprites}
          onSelect={(sourcePoseId) => {
            copyFromSprite(sourcePoseId);
            setShowCopyPicker(false);
          }}
          onClose={() => setShowCopyPicker(false)}
        />
      )}
    </div>
  );
}
