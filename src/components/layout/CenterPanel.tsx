import StatusBanner from '../shared/StatusBanner';
import PoseHeader from '../workflow/PoseHeader';
import GenerationGrid from '../workflow/GenerationGrid';
import ActionBar from '../workflow/ActionBar';
import PromptPreview from '../workflow/PromptPreview';
import { useWorkflow } from '../../hooks/useWorkflow';

export default function CenterPanel() {
  const { state, setCustomInstructions } = useWorkflow();

  return (
    <section className="panel panel-center">
      <StatusBanner />
      <PoseHeader />

      {state.workflowActive && (
        <>
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
