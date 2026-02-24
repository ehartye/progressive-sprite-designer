import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { createCharacter, updateCharacter, deleteCharacter } from '../../api/dataClient';
import type { CharacterData } from '../../api/dataClient';

export default function CharacterAdmin() {
  const { characters, gameTypes, reloadCharacters } = useData();
  const [editing, setEditing] = useState<CharacterData | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const presets = characters.filter(c => c.isPreset);
  const customs = characters.filter(c => !c.isPreset);

  const handleSave = async (data: Partial<CharacterData> & { id?: string }) => {
    setSaving(true);
    try {
      if (data.id) {
        await updateCharacter(data.id, {
          name: data.name,
          gameType: data.gameType,
          genre: data.genre ?? undefined,
          description: data.description,
          equipment: data.equipment,
          colorNotes: data.colorNotes,
        });
      } else {
        await createCharacter({
          name: data.name || '',
          gameType: data.gameType || '',
          genre: data.genre ?? undefined,
          description: data.description || '',
          equipment: data.equipment || '',
          colorNotes: data.colorNotes || '',
        });
      }
      await reloadCharacters();
      setEditing(null);
      setCreating(false);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCharacter(id);
      await reloadCharacters();
      setEditing(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (editing || creating) {
    return (
      <CharacterForm
        character={editing}
        gameTypes={gameTypes}
        saving={saving}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onDelete={editing ? () => handleDelete(editing.id) : undefined}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Character Presets</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          + New Character
        </button>
      </div>

      {presets.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Built-in Presets
          </div>
          {presets.map(c => (
            <CharacterRow key={c.id} character={c} gameTypes={gameTypes} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}

      {customs.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Custom Characters
          </div>
          {customs.map(c => (
            <CharacterRow key={c.id} character={c} gameTypes={gameTypes} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterRow({ character, gameTypes, onEdit }: {
  character: CharacterData;
  gameTypes: Record<string, { name: string }>;
  onEdit: () => void;
}) {
  return (
    <div className="admin-row" onClick={onEdit}>
      <div className="admin-row-main">
        <span className="admin-row-name">{character.name}</span>
        <span className="admin-row-sub">
          {gameTypes[character.gameType]?.name ?? character.gameType}
          {character.genre ? ` / ${character.genre}` : ''}
        </span>
      </div>
      <span className="admin-row-arrow">&rsaquo;</span>
    </div>
  );
}

function CharacterForm({ character, gameTypes, saving, onSave, onCancel, onDelete }: {
  character: CharacterData | null;
  gameTypes: Record<string, { name: string; id: string }>;
  saving: boolean;
  onSave: (data: Partial<CharacterData> & { id?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
    name: character?.name ?? '',
    gameType: character?.gameType ?? '',
    genre: character?.genre ?? '',
    description: character?.description ?? '',
    equipment: character?.equipment ?? '',
    colorNotes: character?.colorNotes ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: character?.id });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          {character ? `Edit: ${character.name}` : 'New Character'}
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          Back
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">Name</label>
        <input className="text-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>

      <div className="form-group">
        <label className="form-label">Game Type</label>
        <select className="select-input" value={form.gameType} onChange={e => setForm(f => ({ ...f, gameType: e.target.value }))} required>
          <option value="">-- Select --</option>
          {Object.values(gameTypes).map(gt => (
            <option key={gt.id} value={gt.id}>{gt.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Genre</label>
        <input className="text-input" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="e.g., Classic Fantasy" />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="textarea-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
      </div>

      <div className="form-group">
        <label className="form-label">Equipment</label>
        <textarea className="textarea-input" rows={2} value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} />
      </div>

      <div className="form-group">
        <label className="form-label">Color Notes</label>
        <textarea className="textarea-input" rows={2} value={form.colorNotes} onChange={e => setForm(f => ({ ...f, colorNotes: e.target.value }))} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {onDelete && (
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
