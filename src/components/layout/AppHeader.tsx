import { useWorkflow } from '../../hooks/useWorkflow';
import type { AppTab } from '../../App';

interface Props {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export default function AppHeader({ tab, onTabChange }: Props) {
  const { state, setModel, testConnection } = useWorkflow();

  return (
    <header className="app-header">
      <div className="header-branding">
        <h1 className="app-title">Sprite Forge</h1>
        <span className="app-subtitle">Powered by Nano Banana</span>
      </div>
      <nav className="header-nav">
        <button
          className={`nav-tab ${tab === 'designer' ? 'active' : ''}`}
          onClick={() => onTabChange('designer')}
        >
          Designer
        </button>
        <button
          className={`nav-tab ${tab === 'gallery' ? 'active' : ''}`}
          onClick={() => onTabChange('gallery')}
        >
          Gallery
        </button>
        <button
          className={`nav-tab ${tab === 'admin' ? 'active' : ''}`}
          onClick={() => onTabChange('admin')}
        >
          Admin
        </button>
      </nav>
      <div className="header-controls">
        <div className="control-group">
          <label className="control-label">Model</label>
          <select
            className="select-input"
            value={state.model}
            onChange={e => setModel(e.target.value)}
          >
            <option value="gemini-2.5-flash-image">Nano Banana (Flash)</option>
            <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
          </select>
        </div>
        <div className="control-group">
          <button className="btn btn-secondary btn-sm" onClick={testConnection}>
            Test Connection
          </button>
        </div>
      </div>
    </header>
  );
}
