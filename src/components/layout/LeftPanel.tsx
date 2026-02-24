import CharacterConfigForm from '../config/CharacterConfigForm';
import CharacterPresets from '../config/CharacterPresets';
import PoseTree from '../workflow/PoseTree';
import ProgressBar from '../workflow/ProgressBar';
import { useWorkflow } from '../../hooks/useWorkflow';

export default function LeftPanel() {
  const { state } = useWorkflow();

  return (
    <aside className="panel panel-left">
      <section className="panel-section">
        <h2 className="section-title">Character Configuration</h2>
        <CharacterPresets />
        <CharacterConfigForm />
      </section>
      {state.workflowActive && (
        <section className="panel-section pose-tree-section">
          <h2 className="section-title">Pose Workflow</h2>
          <ProgressBar />
          <PoseTree />
        </section>
      )}
    </aside>
  );
}
