import { useState, useEffect } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { setPromptData } from './lib/prompts';
import AppHeader from './components/layout/AppHeader';
import LeftPanel from './components/layout/LeftPanel';
import CenterPanel from './components/layout/CenterPanel';
import RightPanel from './components/layout/RightPanel';
import GalleryPage from './components/gallery/GalleryPage';
import AdminPage from './components/admin/AdminPage';

export type AppTab = 'designer' | 'gallery' | 'admin';

export default function App() {
  return (
    <DataProvider>
      <WorkflowProvider>
        <AppInner />
      </WorkflowProvider>
    </DataProvider>
  );
}

function AppInner() {
  const [tab, setTab] = useState<AppTab>('designer');
  const { prompts, loading, error } = useData();

  // Sync prompt data from API into the prompts module
  useEffect(() => {
    if (prompts.superPrompts && Object.keys(prompts.superPrompts).length > 0) {
      setPromptData(prompts.superPrompts, prompts.posePrompts);
    }
  }, [prompts]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
        <p style={{ color: 'var(--error)', fontSize: '1rem' }}>Failed to load: {error}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Make sure the server is running on port 3001.</p>
      </div>
    );
  }

  return (
    <>
      <AppHeader tab={tab} onTabChange={setTab} />
      {tab === 'designer' && (
        <main className="app-layout">
          <LeftPanel />
          <CenterPanel />
          <RightPanel />
        </main>
      )}
      {tab === 'gallery' && (
        <main className="app-single-panel">
          <GalleryPage onSwitchToDesigner={() => setTab('designer')} />
        </main>
      )}
      {tab === 'admin' && (
        <main className="app-single-panel">
          <AdminPage />
        </main>
      )}
    </>
  );
}
