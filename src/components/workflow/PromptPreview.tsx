import { useState } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';

export default function PromptPreview() {
  const { state } = useWorkflow();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className="panel-section prompt-preview-section">
      <h2
        className="section-title collapsible-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="chevron">{collapsed ? '\u25B6' : '\u25BE'}</span>
        Prompt Preview
      </h2>
      {!collapsed && (
        <textarea
          className="textarea-input mono-text prompt-preview-area"
          rows={6}
          readOnly
          value={state.promptPreview}
          placeholder="The constructed prompt will appear here..."
        />
      )}
    </section>
  );
}
