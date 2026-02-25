import { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { fetchHierarchy, updatePose, updatePosePrompt } from '../../api/dataClient';
import type { PhaseData, PoseData } from '../../api/dataClient';

export default function PoseAdmin() {
  const { gameTypes, prompts, reloadPrompts } = useData();
  const [selectedGameType, setSelectedGameType] = useState<string>('');
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPose, setEditingPose] = useState<PoseData | null>(null);

  useEffect(() => {
    if (!selectedGameType) { setPhases([]); return; }
    setLoading(true);
    fetchHierarchy(selectedGameType)
      .then(setPhases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedGameType]);

  if (editingPose) {
    return (
      <PoseForm
        pose={editingPose}
        promptText={prompts.posePrompts[editingPose.id] ?? ''}
        onSave={async (poseData, prompt) => {
          await updatePose(selectedGameType, editingPose.id, {
            name: poseData.name,
            description: poseData.description,
            direction: poseData.direction,
            spriteWidth: poseData.spriteSize.w,
            spriteHeight: poseData.spriteSize.h,
          });
          if (prompt !== undefined) {
            await updatePosePrompt(editingPose.id, prompt);
            await reloadPrompts();
          }
          // Refresh hierarchy
          if (selectedGameType) {
            const updated = await fetchHierarchy(selectedGameType);
            setPhases(updated);
          }
          setEditingPose(null);
        }}
        onCancel={() => setEditingPose(null)}
      />
    );
  }

  return (
    <div>
      <h3 className="section-title">Poses by Game Type</h3>

      <div className="form-group">
        <select
          className="select-input"
          value={selectedGameType}
          onChange={e => setSelectedGameType(e.target.value)}
        >
          <option value="">-- Select Game Type --</option>
          {Object.values(gameTypes).map(gt => (
            <option key={gt.id} value={gt.id}>{gt.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="empty-state-text">Loading poses...</p>}

      {phases.map(phase => (
        <div key={phase.id} style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)',
            padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: '6px'
          }}>
            {phase.name}
            <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({phase.poses.length} poses)
            </span>
          </div>
          {phase.poses.map(pose => (
            <div
              key={pose.id}
              className="admin-row"
              onClick={() => setEditingPose(pose)}
            >
              <div className="admin-row-main">
                <span className="admin-row-name">{pose.name}</span>
                <span className="admin-row-sub">
                  {pose.id} &middot; {pose.spriteSize.w}x{pose.spriteSize.h}
                  {pose.direction ? ` &middot; ${pose.direction}` : ''}
                </span>
              </div>
              <span className="admin-row-arrow">&rsaquo;</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PoseForm({ pose, promptText, onSave, onCancel }: {
  pose: PoseData;
  promptText: string;
  onSave: (pose: PoseData, prompt?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: pose.name,
    description: pose.description,
    direction: pose.direction ?? '',
    w: pose.spriteSize.w,
    h: pose.spriteSize.h,
  });
  const [prompt, setPrompt] = useState(promptText);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        { ...pose, name: form.name, description: form.description, direction: form.direction || null, spriteSize: { w: form.w, h: form.h } },
        prompt !== promptText ? prompt : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Edit: {pose.name}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Back</button>
      </div>

      <div className="form-group">
        <label className="form-label">Pose ID</label>
        <input className="text-input" value={pose.id} disabled style={{ opacity: 0.5 }} />
      </div>

      <div className="form-group">
        <label className="form-label">Name</label>
        <input className="text-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="textarea-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="form-group">
        <label className="form-label">Direction</label>
        <input className="text-input" value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} placeholder="e.g., down, left, side" />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Width (px)</label>
          <input className="text-input" type="number" value={form.w} onChange={e => setForm(f => ({ ...f, w: parseInt(e.target.value) || 16 }))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Height (px)</label>
          <input className="text-input" type="number" value={form.h} onChange={e => setForm(f => ({ ...f, h: parseInt(e.target.value) || 24 }))} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Pose Prompt</label>
        <textarea
          className="textarea-input mono-text"
          rows={4}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
