import React, { useState } from 'react';
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

function App() {
  const [route, setRoute] = useState('tiers');

  function navigate(r: string) { setRoute(r); }

  const activeTier = route.startsWith('detail-') ? route.replace('detail-', '') : null;

  let screen: React.ReactNode = null;
  if (route === 'import') {
    screen = <ImportScreen onComplete={() => navigate('tiers')} />;
  } else if (route === 'tiers') {
    screen = <TiersScreen onTierClick={t => navigate(`detail-${t}`)} onNavigate={navigate} />;
  } else if (route === 'table') {
    screen = <TableScreen />;
  } else if (route === 'distribuicao') {
    screen = <DistribuicaoScreen onNavigate={navigate} />;
  } else if (route === 'dashboard') {
    screen = <DashboardScreen onNavigate={navigate} />;
  } else if (route === 'supervisors') {
    screen = <SupervisorScreen />;
  } else if (activeTier) {
    screen = <DetailScreen tierId={activeTier} onBack={() => navigate('tiers')} onNavigate={navigate} />;
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
