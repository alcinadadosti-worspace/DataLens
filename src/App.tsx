import React from 'react';
import VDApp from './apps/VDApp';
import LojaApp from './apps/LojaApp';
import ModeSelectScreen from './screens/ModeSelectScreen';
import { useAppModeStore } from './store/useAppModeStore';

function App() {
  const mode = useAppModeStore(s => s.mode);

  if (mode === null) return <ModeSelectScreen />;
  if (mode === 'loja') return <LojaApp />;
  return <VDApp />;
}

export default App;
