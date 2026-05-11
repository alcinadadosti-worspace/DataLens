import React from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useFilterStore } from '../../store/useFilterStore';
import { useOrderStore } from '../../store/useOrderStore';

interface TopBarProps {
  onNavigate: (route: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onNavigate }) => {
  const setSearch = useFilterStore(s => s.setSearch);
  const searchQuery = useFilterStore(s => s.searchQuery);
  const fileName = useOrderStore(s => s.fileName);
  const rowCount = useOrderStore(s => s.rowCount);
  const dateRange = useOrderStore(s => s.dateRange);

  function fmtDate(d: Date | null) {
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

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
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #1C1814 0%, #3D362E 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Fraunces, serif', color: '#FAF7F2', fontSize: 18, fontWeight: 600,
        }}>
          D
        </div>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>
          DataLens
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {fileName && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <div style={{ fontSize: 12, color: '#1C1814', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
            {fileName} · {rowCount.toLocaleString('pt-BR')} pedidos
          </div>
          {(dateRange.from || dateRange.to) && (
            <div style={{ fontSize: 10, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>
              {fmtDate(dateRange.from)} – {fmtDate(dateRange.to)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Input
          icon={<i className="ph ph-magnifying-glass" style={{ fontSize: 16 }} />}
          placeholder="Buscar pedido, revendedor..."
          value={searchQuery}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearch('')}
            title="Limpar pesquisa"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8, border: '1px solid #E8E2D6',
              background: 'white', cursor: 'pointer', color: '#6B6258',
              fontSize: 15, flexShrink: 0,
              transition: 'background 150ms, color 150ms, border-color 150ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#FBE5E9';
              (e.currentTarget as HTMLButtonElement).style.color = '#B83A3A';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#F0A8B3';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'white';
              (e.currentTarget as HTMLButtonElement).style.color = '#6B6258';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E2D6';
            }}
          >
            <i className="ph ph-x" />
          </button>
        )}
      </div>

      <Button
        variant="primary"
        size="sm"
        icon={<i className="ph ph-upload-simple" style={{ fontSize: 14 }} />}
        onClick={() => onNavigate('import')}
      >
        Importar
      </Button>

      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #C9A227, #B38A1F)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 600, fontSize: 13, marginLeft: 8,
      }}>
        DL
      </div>
    </div>
  );
};

export default TopBar;
