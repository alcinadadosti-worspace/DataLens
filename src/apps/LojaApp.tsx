import React, { useState } from 'react';
import LojaTopBar from '../components/layout/LojaTopBar';
import LojaSidebar from '../components/layout/LojaSidebar';
import LojaImportScreen from '../screens/loja/LojaImportScreen';
import LojaOverviewScreen from '../screens/loja/LojaOverviewScreen';
import LojaConsultoresScreen from '../screens/loja/LojaConsultoresScreen';
import LojaCanaisFormasScreen from '../screens/loja/LojaCanaisFormasScreen';
import LojaCategoriasScreen from '../screens/loja/LojaCategoriasScreen';
import LojaPeriodoScreen from '../screens/loja/LojaPeriodoScreen';
import LojaAbcScreen from '../screens/loja/LojaAbcScreen';
import LojaPedidosScreen from '../screens/loja/LojaPedidosScreen';
import LojaHorarioScreen from '../screens/loja/LojaHorarioScreen';
import { useLojaStore } from '../store/useLojaStore';

function LojaApp() {
  const hasDataset = useLojaStore(s => !!s.dataset);
  const [route, setRoute] = useState(hasDataset ? 'loja-overview' : 'loja-import');

  function navigate(r: string) {
    setRoute(r);
  }

  let screen: React.ReactNode = null;
  if (route === 'loja-import') {
    screen = <LojaImportScreen onComplete={() => navigate('loja-overview')} />;
  } else if (route === 'loja-overview') {
    screen = <LojaOverviewScreen onNavigate={navigate} />;
  } else if (route === 'loja-consultores') {
    screen = <LojaConsultoresScreen onNavigate={navigate} />;
  } else if (route === 'loja-canais') {
    screen = <LojaCanaisFormasScreen onNavigate={navigate} />;
  } else if (route === 'loja-categorias') {
    screen = <LojaCategoriasScreen onNavigate={navigate} />;
  } else if (route === 'loja-periodo') {
    screen = <LojaPeriodoScreen onNavigate={navigate} />;
  } else if (route === 'loja-abc') {
    screen = <LojaAbcScreen onNavigate={navigate} />;
  } else if (route === 'loja-pedidos') {
    screen = <LojaPedidosScreen onNavigate={navigate} />;
  } else if (route === 'loja-horario') {
    screen = <LojaHorarioScreen onNavigate={navigate} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2' }}>
      <LojaTopBar onNavigate={navigate} />
      <LojaSidebar active={route} onNavigate={navigate} />
      <div style={{ marginLeft: 240, marginTop: 64 }}>
        {screen}
      </div>
    </div>
  );
}

export default LojaApp;
