import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import '../design-system/lojaTheme.css';
import LojaTopBar from '../components/layout/LojaTopBar';
import LojaSidebar from '../components/layout/LojaSidebar';
import ScrollProgress from '../components/ui/ScrollProgress';
import GradualBlur from '../components/ui/GradualBlur';
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
    <div data-loja-theme={theme} style={{ minHeight: '100vh' }}>
      <ScrollProgress />
      <LojaTopBar onNavigate={navigate} />
      <LojaSidebar active={route} onNavigate={navigate} />
      <GradualBlur
        key={route}
        position="bottom"
        target="page"
        height="5rem"
        strength={1.6}
        divCount={3}
        curve="bezier"
        animated
        duration="0.5s"
        zIndex={30}
        style={{ left: 264 }}
      />
      <div style={{ marginLeft: 264, marginTop: 64, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {screen}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default LojaApp;
