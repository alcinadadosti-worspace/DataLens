import React from 'react';
import VDApp from './apps/VDApp';
import LojaApp from './apps/LojaApp';
import ModeSelectScreen from './screens/ModeSelectScreen';
import PinGate from './screens/PinGate';
import { useAppModeStore } from './store/useAppModeStore';

const VD_PIN_HASH = '5f395d07369071a505ef926527de2ac53e8c29e103dc63398315bc276224b81a';
const LOJA_PIN_HASH = 'a994696540befd55c96017a162c7ae2685f2010a7fd3224c0ada25241913933b';

function App() {
  const mode = useAppModeStore(s => s.mode);

  if (mode === null) return <ModeSelectScreen />;
  if (mode === 'loja') {
    return (
      <PinGate
        pinHash={LOJA_PIN_HASH}
        storageKey="datalens_unlocked_loja"
        title="Modo Loja"
        subtitle="Digite o código de acesso do Modo Loja."
      >
        <LojaApp />
      </PinGate>
    );
  }
  return (
    <PinGate
      pinHash={VD_PIN_HASH}
      storageKey="datalens_unlocked_vd"
      title="Modo VD"
      subtitle="Digite o código de acesso do Modo VD."
    >
      <VDApp />
    </PinGate>
  );
}

export default App;
