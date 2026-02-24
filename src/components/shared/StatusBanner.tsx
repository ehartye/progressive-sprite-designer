import { useWorkflow } from '../../hooks/useWorkflow';

export default function StatusBanner() {
  const { state } = useWorkflow();

  if (!state.status) return null;

  return (
    <div className={`status-message status-${state.status.type}`}>
      {state.status.message}
    </div>
  );
}
