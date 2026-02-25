import { useState } from 'react';
import CharacterAdmin from './CharacterAdmin';
import PoseAdmin from './PoseAdmin';
import PromptAdmin from './PromptAdmin';

type AdminTab = 'characters' | 'poses' | 'prompts';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('characters');

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'characters' ? 'active' : ''}`}
          onClick={() => setTab('characters')}
        >
          Characters
        </button>
        <button
          className={`admin-tab ${tab === 'poses' ? 'active' : ''}`}
          onClick={() => setTab('poses')}
        >
          Poses
        </button>
        <button
          className={`admin-tab ${tab === 'prompts' ? 'active' : ''}`}
          onClick={() => setTab('prompts')}
        >
          Prompts
        </button>
      </div>
      <div className="admin-content">
        {tab === 'characters' && <CharacterAdmin />}
        {tab === 'poses' && <PoseAdmin />}
        {tab === 'prompts' && <PromptAdmin />}
      </div>
    </div>
  );
}
