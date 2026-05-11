import React, { useState, useRef, useEffect } from 'react';
import FilterChip from '../ui/FilterChip';
import { useFilterStore } from '../../store/useFilterStore';
import { useOrderStore } from '../../store/useOrderStore';
import { TIER_DEFINITIONS } from '../../design-system/tierStyles';

type MultiKey = 'cycle' | 'supervisor' | 'structure' | 'city' | 'state' | 'modeloComercial' | 'meioCaptacao' | 'situacaoComercial' | 'tier';

interface ColumnDef {
  id: MultiKey;
  label: string;
  options: { value: string; label: string }[];
}

const FilterBuilder: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeCol, setActiveCol] = useState<ColumnDef | null>(null);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filters = useFilterStore();
  const orders = useOrderStore(s => s.orders);

  const cycles      = [...new Set(orders.map(o => o.CicloMarketing).filter(Boolean))].sort();
  const supervisors = [...new Set(orders.map(o => o.ResponsavelEstrutura).filter(Boolean))].sort();
  const structures  = [...new Set(orders.map(o => o.Estrutura).filter(Boolean))].sort();
  const cities      = [...new Set(orders.map(o => o.CidadeEntregaRetirada).filter(Boolean))].sort();
  const states      = [...new Set(orders.map(o => o.UFEntregaRetirada).filter(Boolean))].sort();
  const modelos     = [...new Set(orders.map(o => o.ModeloComercial).filter(Boolean))].sort();
  const meios       = [...new Set(orders.map(o => o.MeioCaptacao).filter(Boolean))].sort();

  const columns: ColumnDef[] = [
    { id: 'cycle',            label: 'Ciclo Marketing',   options: cycles.map(v => ({ value: v, label: v })) },
    { id: 'tier',             label: 'Segmentação',       options: TIER_DEFINITIONS.map(t => ({ value: t.id, label: t.name })) },
    { id: 'supervisor',       label: 'Supervisor',        options: supervisors.map(v => ({ value: v, label: v })) },
    { id: 'structure',        label: 'Estrutura',         options: structures.map(v => ({ value: v, label: v })) },
    { id: 'city',             label: 'Cidade',            options: cities.map(v => ({ value: v, label: v })) },
    { id: 'state',            label: 'UF',                options: states.map(v => ({ value: v, label: v })) },
    { id: 'modeloComercial',  label: 'Modelo Comercial',  options: modelos.map(v => ({ value: v, label: v })) },
    { id: 'meioCaptacao',     label: 'Meio de Captação',  options: meios.map(v => ({ value: v, label: v })) },
    { id: 'situacaoComercial',label: 'Situação',          options: [
      { value: 'Entregue',   label: 'Entregue' },
      { value: 'Cancelado',  label: 'Cancelado' },
      { value: 'Separação',  label: 'Separação' },
      { value: 'Transporte', label: 'Transporte' },
    ]},
  ];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closePanel();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function closePanel() {
    setOpen(false);
    setActiveCol(null);
    setSearch('');
  }

  function openCol(col: ColumnDef) {
    setActiveCol(col);
    setSearch('');
  }

  // Collect all active filter chips (one chip per selected value)
  const activeChips: { colId: MultiKey; colLabel: string; value: string; valueLabel: string }[] = [];
  for (const col of columns) {
    const vals = filters[col.id] as string[] | null;
    if (!vals?.length) continue;
    for (const v of vals) {
      const opt = col.options.find(o => o.value === v);
      activeChips.push({ colId: col.id, colLabel: col.label, value: v, valueLabel: opt?.label ?? v });
    }
  }

  const currentVals = (activeCol ? (filters[activeCol.id] as string[] | null) : null) ?? [];
  const filteredOptions = activeCol
    ? activeCol.options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }} ref={ref}>
      {/* Active filter chips */}
      {activeChips.map(chip => (
        <FilterChip
          key={`${chip.colId}-${chip.value}`}
          column={chip.colLabel}
          value={chip.valueLabel}
          onRemove={() => filters.toggleFilterValue(chip.colId, chip.value)}
        />
      ))}
      {activeChips.length > 0 && (
        <span
          onClick={() => filters.clearFilters()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 999,
            background: 'transparent', border: '1px dashed #D8D0C0',
            fontSize: 12, color: '#9B9287', cursor: 'pointer',
          }}
        >
          <i className="ph ph-x" style={{ fontSize: 11 }} /> Limpar
        </span>
      )}

      {/* Add filter button */}
      <span
        onClick={() => { setOpen(o => !o); setActiveCol(null); setSearch(''); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          background: 'transparent', border: '1px dashed #D8D0C0',
          fontSize: 13, color: '#6B6258', cursor: 'pointer',
        }}
      >
        <i className="ph ph-plus" style={{ fontSize: 12 }} /> filtro
      </span>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
          boxShadow: '0 16px 32px rgba(28,24,20,0.09), 0 4px 8px rgba(28,24,20,0.05)',
          zIndex: 100, overflow: 'hidden',
          display: 'flex', minWidth: 280,
        }}>

          {/* Left: category list */}
          <div style={{ width: 180, borderRight: '1px solid #F2EEE6', padding: '8px 0' }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#6B6258', padding: '6px 14px 8px',
            }}>
              Filtrar por
            </div>
            {columns.map(col => {
              const selected = (filters[col.id] as string[] | null)?.length ?? 0;
              const isActive = col.id === activeCol?.id;
              return (
                <div
                  key={col.id}
                  onClick={() => openCol(col)}
                  style={{
                    padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: isActive ? '#F2EEE6' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#1C1814' : '#3D362E',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#FAF7F2'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{col.label}</span>
                  {selected > 0
                    ? <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#C9A227', color: 'white',
                        borderRadius: 999, padding: '1px 6px', minWidth: 16, textAlign: 'center',
                      }}>{selected}</span>
                    : <span style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>
                        {col.options.length}
                      </span>
                  }
                </div>
              );
            })}
          </div>

          {/* Right: multi-select options */}
          {activeCol && (
            <div style={{ width: 240, display: 'flex', flexDirection: 'column' }}>
              {/* Search */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F2EEE6' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#FAF7F2', borderRadius: 8, padding: '5px 10px',
                  border: '1px solid #E8E2D6',
                }}>
                  <i className="ph ph-magnifying-glass" style={{ fontSize: 13, color: '#9B9287', flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Buscar ${activeCol.label.toLowerCase()}...`}
                    style={{
                      border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 13, color: '#1C1814', width: '100%',
                    }}
                  />
                </div>
              </div>

              {/* Options list */}
              <div style={{ maxHeight: 240, overflowY: 'auto', padding: '6px 0' }}>
                {filteredOptions.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 13, color: '#9B9287' }}>Nenhum resultado</div>
                ) : filteredOptions.map(opt => {
                  const checked = currentVals.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => filters.toggleFilterValue(activeCol.id, opt.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                        background: checked ? '#FFF8E6' : 'transparent',
                        color: checked ? '#1C1814' : '#3D362E',
                      }}
                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#FAF7F2'; }}
                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Checkbox */}
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${checked ? '#C9A227' : '#D8D0C0'}`,
                        background: checked ? '#C9A227' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 120ms',
                      }}>
                        {checked && <i className="ph ph-check" style={{ fontSize: 10, color: 'white' }} />}
                      </span>
                      <span style={{ fontWeight: checked ? 600 : 400 }}>{opt.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              {currentVals.length > 0 && (
                <div style={{
                  padding: '8px 14px', borderTop: '1px solid #F2EEE6',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12,
                }}>
                  <span style={{ color: '#C9A227', fontWeight: 600 }}>
                    {currentVals.length} selecionado{currentVals.length > 1 ? 's' : ''}
                  </span>
                  <span
                    onClick={() => filters.setFilter(activeCol.id, null)}
                    style={{ color: '#9B9287', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Limpar
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
