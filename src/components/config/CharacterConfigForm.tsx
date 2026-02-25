import { useWorkflow } from '../../hooks/useWorkflow';
import { useData } from '../../context/DataContext';
import { saveCustomCharacter } from '../../lib/characterStore';

export default function CharacterConfigForm() {
  const { state, startWorkflow, setCharacterConfig, setStatus, resetWorkflow } = useWorkflow();
  const { gameTypes, reloadCharacters } = useData();
  const { characterConfig, workflowActive } = state;

  const canStart = characterConfig.gameType && characterConfig.name.trim() && characterConfig.description.trim();

  const handleStart = () => {
    startWorkflow(characterConfig);
  };

  const handleSave = async () => {
    if (!characterConfig.name.trim()) {
      setStatus('Enter a character name before saving.', 'warning');
      return;
    }
    try {
      await saveCustomCharacter({
        name: characterConfig.name,
        gameType: characterConfig.gameType,
        description: characterConfig.description,
        equipment: characterConfig.equipment,
        colorNotes: characterConfig.colorNotes,
      });
      await reloadCharacters();
      setStatus(`Character "${characterConfig.name}" saved!`, 'success');
    } catch {
      setStatus('Failed to save character', 'error');
    }
  };

  return (
    <>
      <div className="form-group">
        <label className="form-label">Game Type</label>
        <select
          className="select-input"
          value={characterConfig.gameType}
          onChange={e => setCharacterConfig({ gameType: e.target.value })}
          disabled={workflowActive}
        >
          <option value="">-- Select game type --</option>
          {Object.values(gameTypes).map(gt => (
            <option key={gt.id} value={gt.id}>{gt.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Character Name</label>
        <input
          className="text-input"
          value={characterConfig.name}
          onChange={e => setCharacterConfig({ name: e.target.value })}
          placeholder="e.g., Elara the Ranger"
          disabled={workflowActive}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Physical Appearance</label>
        <textarea
          className="textarea-input"
          rows={3}
          value={characterConfig.description}
          onChange={e => setCharacterConfig({ description: e.target.value })}
          placeholder="Describe the character's physical appearance..."
          disabled={workflowActive}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Equipment / Accessories</label>
        <textarea
          className="textarea-input"
          rows={2}
          value={characterConfig.equipment}
          onChange={e => setCharacterConfig({ equipment: e.target.value })}
          placeholder="e.g., leather armor, longbow, green cloak..."
          disabled={workflowActive}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Color Notes</label>
        <textarea
          className="textarea-input"
          rows={2}
          value={characterConfig.colorNotes}
          onChange={e => setCharacterConfig({ colorNotes: e.target.value })}
          placeholder="e.g., brown hair, green eyes, earth tones..."
          disabled={workflowActive}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {workflowActive ? (
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={resetWorkflow}
          >
            End Workflow
          </button>
        ) : (
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={!canStart}
            onClick={handleStart}
          >
            Start Workflow
          </button>
        )}
        <button
          className="btn btn-secondary"
          disabled={!characterConfig.name.trim()}
          onClick={handleSave}
          title="Save character for later"
        >
          Save
        </button>
      </div>
    </>
  );
}
