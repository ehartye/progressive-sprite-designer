import { useWorkflow } from '../../hooks/useWorkflow';

export default function AppHeader() {
  const { state, setModel, testConnection } = useWorkflow();

  return (
    <header className="app-header">
      <div className="header-branding">
        <h1 className="app-title">Sprite Forge</h1>
        <span className="app-subtitle">Powered by Nano Banana</span>
      </div>
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
