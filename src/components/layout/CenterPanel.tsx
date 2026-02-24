import { useMemo } from 'react';
import StatusBanner from '../shared/StatusBanner';
import PoseHeader from '../workflow/PoseHeader';
import GenerationGrid from '../workflow/GenerationGrid';
import ActionBar from '../workflow/ActionBar';
import PromptPreview from '../workflow/PromptPreview';
import { useWorkflow } from '../../hooks/useWorkflow';
import { getPromptForPose } from '../../lib/prompts';

export default function CenterPanel() {
  const { state, setCustomInstructions } = useWorkflow();

  const currentPose = state.workflowActive
    ? state.hierarchy[state.currentPhaseIndex]?.poses[state.currentPoseIndex] ?? null
    : null;

  const posePrompt = useMemo(() => {
    if (!currentPose) return '';
    try {
      return getPromptForPose(currentPose.id);
    } catch {
      return '';
    }
  }, [currentPose]);

  return (
    <section className="panel panel-center">
      <StatusBanner />
      <PoseHeader />

      {state.workflowActive && (
        <>
          {posePrompt && (
            <div className="pose-instructions-wrapper">
              <label className="form-label">
                Pose Instructions{currentPose ? ` — ${currentPose.name}` : ''}
              </label>
              <div className="pose-instructions-box mono-text">{posePrompt}</div>
            </div>
          )}

          <div className="custom-instructions-wrapper">
            <label className="form-label">Custom Instructions</label>
            <textarea
              className="textarea-input mono-text"
              rows={2}
              placeholder="Add custom instructions for this pose (optional)..."
              value={state.customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
            />
          </div>

          <GenerationGrid />
          <ActionBar />
          <PromptPreview />
        </>
      )}
    </section>
  );
}
