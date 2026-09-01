import React from 'react';
import { useAppModeStore } from '../store/useAppModeStore';

const ModeSelectScreen: React.FC = () => {
  const setMode = useAppModeStore(s => s.setMode);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(28,24,20,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#FAF7F2', borderRadius: 24, padding: 48,
        maxWidth: 480, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        border: '1px solid #E8E2D6',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1C1814 0%, #3D362E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Fraunces, serif', color: '#FAF7F2', fontSize: 24, fontWeight: 600,
          }}>
            D
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
            Escolha o modo de leitura
          </h1>
          <p style={{ color: '#6B6258', fontSize: 14, marginTop: 8 }}>
            Cada modo interpreta um tipo diferente de dado de origem.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 56 }}>
          <ModeButton icon="ph-user" label="Modo VD" onClick={() => setMode('vd')} />
          <ModeButton icon="ph-shopping-cart" label="Modo Loja" onClick={() => setMode('loja')} />
        </div>
      </div>
    </div>
  );
};

interface ModeButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ icon, label, onClick }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="glossy-btn" onClick={onClick} style={{ width: 88, height: 88, fontSize: 16 }}>
        <span className="glossy-outer" style={{ width: '100%', height: '100%' }}>
          <span
            className="glossy-inner"
            style={{ width: '100%', height: '100%', padding: 0, justifyContent: 'center' }}
          >
            <i className={`ph ph-bold ${icon}`} style={{ fontSize: 30 }} />
          </span>
        </span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1814', letterSpacing: '-0.01em' }}>{label}</span>
    </div>
  );
};

export default ModeSelectScreen;
