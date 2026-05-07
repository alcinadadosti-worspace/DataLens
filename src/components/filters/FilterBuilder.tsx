import React, { useState, useRef, useEffect } from 'react';
import FilterChip from '../ui/FilterChip';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useFilterStore } from '../../store/useFilterStore';
import { useOrderStore } from '../../store/useOrderStore';
import { TIER_DEFINITIONS } from '../../design-system/tierStyles';
import { FilterState } from '../../types/analytics';

interface FilterOption {
  value: string;
  label: string;
}

interface ColumnDef {
  id: string;
  label: string;
  type: 'text' | 'enum' | 'number';
  options?: FilterOption[];
  storeKey?: string;
}

const FilterBuilder: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'column' | 'value'>('column');
  const [draftCol, setDraftCol] = useState<ColumnDef | null>(null);
  const [draftOp, setDraftOp] = useState('=');
  const [draftVal, setDraftVal] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filters = useFilterStore();
  const orders = useOrderStore(s => s.orders);

  // Derive dynamic options from actual data
  const cycles = [...new Set(orders.map(o => o.CicloMarketing).filter(Boolean))].sort();
  const supervisors = [...new Set(orders.map(o => o.ResponsavelEstrutura).filter(Boolean))].sort();
  const structures = [...new Set(orders.map(o => o.Estrutura).filter(Boolean))].sort();
  const cities = [...new Set(orders.map(o => o.CidadeEntregaRetirada).filter(Boolean))].sort();
  const states = [...new Set(orders.map(o => o.UFEntregaRetirada).filter(Boolean))].sort();
  const modelos = [...new Set(orders.map(o => o.ModeloComercial).filter(Boolean))].sort();
  const meios = [...new Set(orders.map(o => o.MeioCaptacao).filter(Boolean))].sort();

  const columns: ColumnDef[] = [
    { id: 'cycle', label: 'Ciclo Marketing', type: 'enum', storeKey: 'cycle', options: cycles.map(v => ({ value: v, label: v })) },
    { id: 'tier', label: 'Tier', type: 'enum', storeKey: 'tier', options: TIER_DEFINITIONS.map(t => ({ value: t.id, label: t.name })) },
    { id: 'supervisor', label: 'Supervisor', type: 'enum', storeKey: 'supervisor', options: supervisors.map(v => ({ value: v, label: v })) },
    { id: 'structure', label: 'Estrutura', type: 'enum', storeKey: 'structure', options: structures.map(v => ({ value: v, label: v })) },
    { id: 'city', label: 'Cidade', type: 'enum', storeKey: 'city', options: cities.map(v => ({ value: v, label: v })) },
    { id: 'state', label: 'UF', type: 'enum', storeKey: 'state', options: states.map(v => ({ value: v, label: v })) },
    { id: 'modeloComercial', label: 'Modelo Comercial', type: 'enum', storeKey: 'modeloComercial', options: modelos.map(v => ({ value: v, label: v })) },
    { id: 'meioCaptacao', label: 'Meio Captação', type: 'enum', storeKey: 'meioCaptacao', options: meios.map(v => ({ value: v, label: v })) },
    { id: 'situacaoComercial', label: 'Situação Comercial', type: 'enum', storeKey: 'situacaoComercial', options: [
      { value: 'Entregue', label: 'Entregue' },
      { value: 'Cancelado', label: 'Cancelado' },
      { value: 'Separação', label: 'Separação' },
      { value: 'Transporte', label: 'Transporte' },
    ]},
  ];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function close() {
    setOpen(false);
    setStep('column');
    setDraftCol(null);
    setDraftVal('');
  }

  function pickColumn(col: ColumnDef) {
    setDraftCol(col);
    setStep('value');
    setDraftOp('=');
    setDraftVal('');
  }

  function commit() {
    if (!draftCol || !draftVal || !draftCol.storeKey) return;
    filters.setFilter(draftCol.storeKey as keyof FilterState, draftVal);
    close();
  }

  // Active filter chips
  const activeFilters: { key: keyof FilterState; label: string; value: string }[] = [];
  columns.forEach(col => {
    if (!col.storeKey) return;
    const storeKey = col.storeKey as keyof FilterState;
    const val = filters[storeKey] as string | null;
    if (val) {
      const opt = col.options?.find(o => o.value === val);
      activeFilters.push({ key: storeKey, label: col.label, value: opt?.label ?? val });
    }
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }} ref={ref}>
      {activeFilters.map(f => (
        <FilterChip
          key={String(f.key)}
          column={f.label}
          value={f.value}
          onRemove={() => filters.setFilter(f.key, null)}
        />
      ))}
      {activeFilters.length > 0 && (
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
      <span
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          background: 'transparent', border: '1px dashed #D8D0C0',
          fontSize: 13, color: '#6B6258', cursor: 'pointer',
        }}
      >
        <i className="ph ph-plus" style={{ fontSize: 12 }} /> filtro
      </span>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
          boxShadow: '0 16px 32px rgba(28,24,20,0.09), 0 4px 8px rgba(28,24,20,0.05)',
          padding: 8, minWidth: 280, zIndex: 100,
        }}>
          {step === 'column' && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#6B6258', padding: '8px 12px 4px',
              }}>
                Filtrar por
              </div>
              {columns.map(col => (
                <div
                  key={col.id}
                  onClick={() => pickColumn(col)}
                  style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F2EEE6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{col.label}</span>
                  <span style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>
                    {col.options?.length ?? 0}
                  </span>
                </div>
              ))}
            </>
          )}

          {step === 'value' && draftCol && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  onClick={() => { setStep('column'); setDraftCol(null); }}
                  style={{ cursor: 'pointer', color: '#6B6258', fontSize: 14 }}
                >
                  <i className="ph ph-arrow-left" />
                </span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{draftCol.label}</div>
              </div>

              {draftCol.type === 'enum' && draftCol.options ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
                  {draftCol.options.map(o => (
                    <div
                      key={o.value}
                      onClick={() => {
                        if (draftCol.storeKey) {
                          filters.setFilter(draftCol.storeKey as keyof FilterState, o.value);
                        }
                        close();
                      }}
                      style={{ padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F2EEE6')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {o.label}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Valor..."
                    value={draftVal}
                    onChange={e => setDraftVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && commit()}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={close}>Cancelar</Button>
                    <Button variant="primary" size="sm" onClick={commit}>Adicionar</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBuilder;
