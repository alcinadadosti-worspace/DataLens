import React, { useState, useEffect } from 'react';
import TopBar from './components/layout/TopBar';
import Sidebar from './components/layout/Sidebar';
import TierAmbience from './components/TierAmbience';
import ImportScreen from './screens/ImportScreen';
import TiersScreen from './screens/TiersScreen';
import TableScreen from './screens/TableScreen';
import DetailScreen from './screens/DetailScreen';
import DashboardScreen from './screens/DashboardScreen';
import SupervisorScreen from './screens/SupervisorScreen';
import DistribuicaoScreen from './screens/DistribuicaoScreen';
import ComparacaoSemanalScreen from './screens/ComparacaoSemanalScreen';
import { parseSpreadsheet } from './parsers/spreadsheetParser';
import { useOrderStore } from './store/useOrderStore';
import { useFilterStore } from './store/useFilterStore';

function App() {
  const [route, setRoute] = useState('tiers');
  const [selectedReseller, setSelectedReseller] = useState<{ id: string; name: string } | null>(null);
  const setOrders = useOrderStore(s => s.setOrders);
  const hasOrders = useOrderStore(s => s.orders.length > 0);
  const setFilter = useFilterStore(s => s.setFilter);

  useEffect(() => {
    if (hasOrders) return;
    fetch('/ConsultaPedidos_Completo.xlsx')
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'ConsultaPedidos_Completo.xlsx', { type: blob.type });
        return parseSpreadsheet(file);
      })
      .then(result => {
        if (result.orders.length > 0) {
          setOrders(result.orders, 'ConsultaPedidos_Completo.xlsx');
          setFilter('cycle', '07/2026');
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
    screen = <SupervisorScreen />;
  } else if (activeTier) {
    screen = <DetailScreen tierId={activeTier} onBack={() => navigate('tiers')} onNavigate={navigate} onResellerClick={(id, name) => setSelectedReseller({ id, name })} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7F2',
      position: 'relative',
      isolation: 'isolate',
    }}>
      {/* Themed environment — only when a tier detail is active */}
      <TierAmbience tierId={activeTier} />

      {/* App chrome + screen content sits above the ambience */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <TopBar onNavigate={navigate} />
        <Sidebar active={route} onNavigate={navigate} activeTier={activeTier} />
        <div style={{ marginLeft: 240, marginTop: 64 }}>
          {screen}
        </div>
      </div>
    </div>
  );
}

export default App;
