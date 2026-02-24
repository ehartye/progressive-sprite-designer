import { WorkflowProvider } from './context/WorkflowContext';
import AppHeader from './components/layout/AppHeader';
import LeftPanel from './components/layout/LeftPanel';
import CenterPanel from './components/layout/CenterPanel';
import RightPanel from './components/layout/RightPanel';

export default function App() {
  return (
    <WorkflowProvider>
      <AppHeader />
      <main className="app-layout">
        <LeftPanel />
        <CenterPanel />
        <RightPanel />
      </main>
    </WorkflowProvider>
  );
}
