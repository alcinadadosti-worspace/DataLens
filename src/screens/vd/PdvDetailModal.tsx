import React, { useMemo } from 'react';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { useOrderStore } from '../../store/useOrderStore';
import { buildCidadeToPdv, pdvForCidade } from '../../analytics/pdvMapping';
import { isRevenueEligible } from '../../analytics/financialMetrics';
import { fmtBRL, fmtNumber } from '../../utils/formatters';

interface Props {
  pdvCodigo: string | null;
  onClose: () => void;
}

const stat: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 };
const statLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-text-muted, #9B9287)' };
const statValue: React.CSSProperties = { fontSize: 18, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' };

/**
 * PDV 360 — junta num só painel o que hoje está espalhado em telas diferentes (Receita, Base,
 * Ruptura, Sell-In, Pedidos) filtrado pra um único PDV. Aberto por clique num código de PDV em
 * qualquer tabela que já mostre PDV.
 */
const PdvDetailModal: React.FC<Props> = ({ pdvCodigo, onClose }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const orders = useOrderStore(s => s.orders);
  const cidadeToPdv = useMemo(() => buildCidadeToPdv(dataset), [dataset]);

  const info = useMemo(() => {
    if (!pdvCodigo) return null;

    const receitaRows = (dataset?.receitaCanalVDPdv ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const receitaAtual = receitaRows.reduce((s, r) => s + r.total.receitaAtual, 0);
    const metaPef = receitaRows.reduce((s, r) => s + r.total.metaPef, 0);
    const cidade = receitaRows[0]?.cidade ?? '';

    const monitor = dataset?.monitoramentoBase?.porPdv.find(r => r.chave === pdvCodigo) ?? null;

    const rupturaItens = (dataset?.rupturaPorItem ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const rupturaMedia = rupturaItens.length > 0 ? rupturaItens.reduce((s, r) => s + r.rupturaPct, 0) / rupturaItens.length : null;

    const sellInRows = (dataset?.sellInDetalheSku ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const sellInSugestao = sellInRows.reduce((s, r) => s + r.sugestaoComercial, 0);
    const sellInRealizado = sellInRows.reduce((s, r) => s + r.pedidoRealizado, 0);

    const pdvOrders = orders.filter(o => {
      const p = pdvForCidade(cidadeToPdv, o.CidadeEntregaRetirada) ?? pdvForCidade(cidadeToPdv, o.Cidade);
      return p === pdvCodigo;
    });
    const pedidosElegiveis = pdvOrders.filter(isRevenueEligible);
    const receitaPedidos = pedidosElegiveis.reduce((s, o) => s + o.ValorPraticado, 0);

    return {
      cidade, receitaAtual, metaPef, monitor,
      rupturaMedia, rupturaCount: rupturaItens.length,
      sellInSugestao, sellInRealizado,
      pedidosCount: pdvOrders.length, receitaPedidos,
    };
  }, [pdvCodigo, dataset, orders, cidadeToPdv]);

  if (!pdvCodigo || !info) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(28,24,20,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--vd-surface, #FFFFFF)', borderRadius: 20, padding: 28,
          maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>PDV 360</div>
            <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '4px 0 0' }}>
              PDV {pdvCodigo} {info.cidade && <span style={{ color: 'var(--vd-text-secondary, #6B6258)', fontWeight: 400 }}>· {info.cidade}</span>}
            </h2>
          </div>
          <button className="glossy-btn" onClick={onClose} style={{ borderRadius: 8, fontSize: 12, padding: '6px 10px' }}>
            <i className="ph ph-x" />
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Receita (BI corporativo)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
          <div style={stat}><span style={statLabel}>Receita atual (Total)</span><span style={statValue}>{fmtBRL(info.receitaAtual)}</span></div>
          <div style={stat}><span style={statLabel}>Meta PEF</span><span style={statValue}>{fmtBRL(info.metaPef)}</span></div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Pedidos (Order[], cruzado por cidade)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
          <div style={stat}><span style={statLabel}>Pedidos</span><span style={statValue}>{fmtNumber(info.pedidosCount)}</span></div>
          <div style={stat}><span style={statLabel}>Receita elegível</span><span style={statValue}>{fmtBRL(info.receitaPedidos)}</span></div>
        </div>

        {info.monitor && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Base de revendedores</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              <div style={stat}><span style={statLabel}>Base ativa</span><span style={statValue}>{fmtNumber(info.monitor.baseAtiva)}</span></div>
              <div style={stat}><span style={statLabel}>RPA</span><span style={statValue}>{fmtBRL(info.monitor.rpa)}</span></div>
              <div style={stat}><span style={statLabel}>% Churn</span><span style={{ ...statValue, color: info.monitor.churnPct > 3 ? 'var(--vd-danger, #B83A3A)' : undefined }}>{info.monitor.churnPct.toFixed(2).replace('.', ',')}%</span></div>
            </div>
          </>
        )}

        {info.rupturaMedia !== null && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Ruptura</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
              <div style={stat}><span style={statLabel}>% Ruptura média (itens monitorados)</span><span style={statValue}>{info.rupturaMedia.toFixed(2).replace('.', ',')}%</span></div>
              <div style={stat}><span style={statLabel}>SKUs monitorados</span><span style={statValue}>{fmtNumber(info.rupturaCount)}</span></div>
            </div>
          </>
        )}

        {info.sellInSugestao > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Sell-In</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={stat}><span style={statLabel}>Sugestão comercial</span><span style={statValue}>{fmtNumber(info.sellInSugestao)}</span></div>
              <div style={stat}><span style={statLabel}>Pedido realizado</span><span style={statValue}>{fmtNumber(info.sellInRealizado)}</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PdvDetailModal;
