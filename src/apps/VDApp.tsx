import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import '../design-system/vdTheme.css';
import '../design-system/chartTheme.css';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import TierAmbience from '../components/TierAmbience';
import ScrollProgress from '../components/ui/ScrollProgress';
import { useVDThemeStore } from '../store/useVDThemeStore';
import ImportScreen from '../screens/ImportScreen';
import TiersScreen from '../screens/TiersScreen';
import TableScreen from '../screens/TableScreen';
import DetailScreen from '../screens/DetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SupervisorScreen from '../screens/SupervisorScreen';
import DistribuicaoScreen from '../screens/DistribuicaoScreen';
import ComparacaoSemanalScreen from '../screens/ComparacaoSemanalScreen';
import { parseSpreadsheet } from '../parsers/spreadsheetParser';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';

function VDApp() {
  const [route, setRoute] = useState('tiers');
  const [selectedReseller, setSelectedReseller] = useState<{ id: string; name: string } | null>(null);
  const theme = useVDThemeStore(s => s.theme);
  const setOrders = useOrderStore(s => s.setOrders);
  const hasOrders = useOrderStore(s => s.orders.length > 0);
  const setFilter = useFilterStore(s => s.setFilter);

  useEffect(() => {
    if (hasOrders) return;
    fetch('/ConsultaPedidos_Unificado.xlsx')
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'ConsultaPedidos_Unificado.xlsx', { type: blob.type });
        return parseSpreadsheet(file);
      })
      .then(result => {
        if (result.orders.length > 0 && useOrderStore.getState().orders.length === 0) {
          setOrders(result.orders, 'ConsultaPedidos_Unificado.xlsx');
          useFilterStore.setState({ cycle: ['12/2026'], dateFrom: '2026-08-10', dateTo: '2026-08-30' });
        }
      })
      .catch(() => {/* silently skip if sample not available */});
  }, []);

  function navigate(r: string) {
    setRoute(r);
    // Clear reseller selection when navigating away from the table
    if (r !== 'table') setSelectedReseller(null);
  }

  const activeTier = route.startsWith('detail-') ? route.replace('detail-', '') : null;

  let screen: React.ReactNode = null;
  if (route === 'import') {
    screen = <ImportScreen onComplete={() => navigate('tiers')} />;
  } else if (route === 'tiers') {
    screen = <TiersScreen onTierClick={t => navigate(`detail-${t}`)} onNavigate={navigate} />;
  } else if (route === 'table') {
    screen = <TableScreen selectedReseller={selectedReseller} onClearReseller={() => setSelectedReseller(null)} />;
  } else if (route === 'distribuicao') {
    screen = <DistribuicaoScreen onNavigate={navigate} />;
  } else if (route === 'dashboard') {
    screen = <DashboardScreen onNavigate={navigate} />;
  } else if (route === 'comparacao-semanal') {
    screen = <ComparacaoSemanalScreen onNavigate={navigate} />;
  } else if (route === 'supervisors') {
    screen = <SupervisorScreen onNavigate={navigate} />;
  } else if (activeTier) {
    screen = <DetailScreen tierId={activeTier} onBack={() => navigate('tiers')} onNavigate={navigate} onResellerClick={(id, name) => setSelectedReseller({ id, name })} />;
  }

  return (
    <div data-vd-theme={theme} style={{
      minHeight: '100vh',
      background: 'var(--vd-bg, #FAF7F2)',
      position: 'relative',
      isolation: 'isolate',
    }}>
      {/* Ambiente de metais/pedras — sempre presente (neutro fora de um detalhe de segmentação) */}
      <TierAmbience tierId={activeTier ?? 'cf'} />

      <ScrollProgress left={240} gradient="linear-gradient(180deg, #FCEFB0 0%, #C9A227 55%, #6B4E0F 100%)" glow="rgba(201, 162, 39, 0.65)" />

      {/* App chrome + screen content sits above the ambience */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <TopBar onNavigate={navigate} />
        <Sidebar active={route} onNavigate={navigate} activeTier={activeTier} />
        <div style={{ marginLeft: 240, marginTop: 64, position: 'relative' }}>
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
    </div>
  );
}

export default VDApp;
