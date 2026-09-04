import React from 'react';
import Button from '../ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { useAppModeStore } from '../../store/useAppModeStore';

interface LojaTopBarProps {
  onNavigate: (route: string) => void;
}

const LojaTopBar: React.FC<LojaTopBarProps> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const resetMode = useAppModeStore(s => s.resetMode);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 64,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #E8E2D6',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'linear-gradient(135deg, #1C1814 0%, #3D362E 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Fraunces, serif', color: '#FAF7F2', fontSize: 20, fontWeight: 600,
        }}>
          D
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em' }}>
            DataLens
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {dataset && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <div style={{ fontSize: 13, color: '#1C1814', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            {dataset.lojas.length} lojas · importado em {dataset.importedAt.toLocaleDateString('pt-BR')}
          </div>
        </div>
      )}

      <Button
        variant="secondary"
        size="md"
        icon={<i className="ph ph-arrows-left-right" style={{ fontSize: 15 }} />}
        onClick={resetMode}
      >
        Trocar modo
      </Button>

      <Button
        variant="primary"
        size="md"
        icon={<i className="ph ph-upload-simple" style={{ fontSize: 15 }} />}
        onClick={() => onNavigate('loja-import')}
      >
        Importar
      </Button>
    </div>
  );
};

export default LojaTopBar;
