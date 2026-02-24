import { useState, useEffect } from 'react';
import { useWorkflow } from '../../hooks/useWorkflow';
import { getPresetCharacters, getCustomCharacters, deleteCustomCharacter, type CharacterConfig } from '../../lib/characterStore';
import { GAME_TYPES } from '../../lib/poses';

export default function CharacterPresets() {
  const { setCharacterConfig, state, setStatus } = useWorkflow();
  const [presets] = useState(() => getPresetCharacters());
  const [customs, setCustoms] = useState(() => getCustomCharacters());
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [customsOpen, setCustomsOpen] = useState(false);

  // Listen for save events to refresh custom list
  useEffect(() => {
    const handler = () => setCustoms(getCustomCharacters());
    window.addEventListener('characters-updated', handler);
    return () => window.removeEventListener('characters-updated', handler);
  }, []);

  const loadCharacter = (char: CharacterConfig) => {
    if (state.workflowActive) return;
    setCharacterConfig({
      gameType: char.gameType,
      name: char.name,
      description: char.description,
      equipment: char.equipment,
      colorNotes: char.colorNotes,
    });
    setStatus(`Loaded "${char.name}"`, 'info');
  };

  const handleDelete = (id: string, name: string) => {
    deleteCustomCharacter(id);
    setCustoms(getCustomCharacters());
    setStatus(`Deleted "${name}"`, 'info');
  };

  // Group presets by game type
  const grouped = Object.keys(GAME_TYPES).map(gtId => ({
    gameType: GAME_TYPES[gtId],
    characters: presets.filter((p: CharacterConfig) => p.gameType === gtId),
  })).filter(g => g.characters.length > 0);

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Preset Characters */}
      <div
        className="collapsible-header section-title"
        style={{ marginBottom: '8px', fontSize: '0.75rem' }}
        onClick={() => setPresetsOpen(!presetsOpen)}
      >
        <span className="chevron">{presetsOpen ? '\u25BE' : '\u25B6'}</span>
        Sample Characters ({presets.length})
      </div>
      {presetsOpen && (
        <div style={{ marginBottom: '12px' }}>
          {grouped.map(group => (
            <div key={group.gameType.id} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', paddingLeft: '4px' }}>
                {group.gameType.name}
              </div>
              {group.characters.map((char: CharacterConfig) => (
                <div
                  key={char.id}
                  onClick={() => loadCharacter(char)}
                  style={{
                    padding: '6px 8px',
                    cursor: state.workflowActive ? 'not-allowed' : 'pointer',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    transition: 'background 120ms ease',
                    opacity: state.workflowActive ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!state.workflowActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>{char.name}</strong>
                  {char.genre && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>({char.genre})</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Custom Characters */}
      {customs.length > 0 && (
        <>
          <div
            className="collapsible-header section-title"
            style={{ marginBottom: '8px', fontSize: '0.75rem' }}
            onClick={() => setCustomsOpen(!customsOpen)}
          >
            <span className="chevron">{customsOpen ? '\u25BE' : '\u25B6'}</span>
            My Characters ({customs.length})
          </div>
          {customsOpen && (
            <div style={{ marginBottom: '12px' }}>
              {customs.map((char: CharacterConfig) => (
                <div
                  key={char.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                  }}
                >
                  <span
                    onClick={() => loadCharacter(char)}
                    style={{ cursor: state.workflowActive ? 'not-allowed' : 'pointer', color: 'var(--text-primary)', flex: 1 }}
                  >
                    {char.name}
                    {char.gameType && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{GAME_TYPES[char.gameType]?.name}</span>}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(char.id, char.name); }}
                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 6px' }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
