import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { updateSuperPrompt } from '../../api/dataClient';

export default function PromptAdmin() {
  const { gameTypes, prompts, reloadPrompts } = useData();
  const [editingGameType, setEditingGameType] = useState<string | null>(null);

  if (editingGameType) {
    return (
      <SuperPromptForm
        gameType={editingGameType}
        gameTypeName={gameTypes[editingGameType]?.name ?? editingGameType}
        initialTemplate={prompts.superPrompts[editingGameType] ?? ''}
        onSave={async (template) => {
          await updateSuperPrompt(editingGameType, template);
          await reloadPrompts();
          setEditingGameType(null);
        }}
        onCancel={() => setEditingGameType(null)}
      />
    );
  }

  return (
    <div>
      <h3 className="section-title">Super Prompts (per Game Type)</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        These are the base prompts prepended to every generation. Use &#123;w&#125; and &#123;h&#125; as size placeholders.
      </p>

      {Object.values(gameTypes).map(gt => (
        <div key={gt.id} className="admin-row" onClick={() => setEditingGameType(gt.id)}>
          <div className="admin-row-main">
            <span className="admin-row-name">{gt.name}</span>
            <span className="admin-row-sub">
              {(prompts.superPrompts[gt.id] ?? '').slice(0, 80)}...
            </span>
          </div>
          <span className="admin-row-arrow">&rsaquo;</span>
        </div>
      ))}
    </div>
  );
}

function SuperPromptForm({ gameType, gameTypeName, initialTemplate, onSave, onCancel }: {
  gameType: string;
  gameTypeName: string;
  initialTemplate: string;
  onSave: (template: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(template);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Super Prompt: {gameTypeName}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Back</button>
      </div>

      <div className="form-group">
        <label className="form-label">Game Type ID</label>
        <input className="text-input" value={gameType} disabled style={{ opacity: 0.5 }} />
      </div>

      <div className="form-group">
        <label className="form-label">Prompt Template</label>
        <textarea
          className="textarea-input mono-text"
          rows={10}
          value={template}
          onChange={e => setTemplate(e.target.value)}
        />
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Use &#123;w&#125; for sprite width and &#123;h&#125; for sprite height.
        </div>
      </div>

      <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
