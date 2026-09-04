import React, { useState } from 'react';
import '../design-system/lojaTheme.css';
import LojaTopBar from '../components/layout/LojaTopBar';
import LojaSidebar from '../components/layout/LojaSidebar';
import LiquidGridBackground from '../components/ui/LiquidGridBackground';
import ScrollProgress from '../components/ui/ScrollProgress';
import ScreenTransition from '../components/ui/ScreenTransition';
import LojaImportScreen from '../screens/loja/LojaImportScreen';
import LojaOverviewScreen from '../screens/loja/LojaOverviewScreen';
import LojaConsultoresScreen from '../screens/loja/LojaConsultoresScreen';
import LojaCanaisFormasScreen from '../screens/loja/LojaCanaisFormasScreen';
import LojaCategoriasScreen from '../screens/loja/LojaCategoriasScreen';
import LojaPeriodoScreen from '../screens/loja/LojaPeriodoScreen';
import LojaAbcScreen from '../screens/loja/LojaAbcScreen';
import LojaPedidosScreen from '../screens/loja/LojaPedidosScreen';
import LojaHorarioScreen from '../screens/loja/LojaHorarioScreen';
import LojaFidelidadeServicosScreen from '../screens/loja/LojaFidelidadeServicosScreen';
import { useLojaStore } from '../store/useLojaStore';
import { useLojaThemeStore } from '../store/useLojaThemeStore';

function LojaApp() {
  const hasDataset = useLojaStore(s => !!s.dataset);
  const theme = useLojaThemeStore(s => s.theme);
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
  } else if (route === 'loja-fidelidade-servicos') {
    screen = <LojaFidelidadeServicosScreen onNavigate={navigate} />;
  }

  return (
    <div data-loja-theme={theme} style={{ minHeight: '100vh', position: 'relative' }}>
      <LiquidGridBackground />
      <ScrollProgress />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <LojaTopBar onNavigate={navigate} />
        <LojaSidebar active={route} onNavigate={navigate} />
        <div style={{ marginLeft: 264, marginTop: 64 }}>
          <ScreenTransition routeKey={route}>
            {screen}
          </ScreenTransition>
        </div>
      </div>
    </div>
  );
}

export default LojaApp;
