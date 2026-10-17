import React, { useMemo } from 'react';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { useOrderStore } from '../../store/useOrderStore';
import { pdvForOrder } from '../../analytics/pdvMapping';
import { isRevenueEligible } from '../../analytics/financialMetrics';
import { metaPefCanalVD } from '../../analytics/metaPefCanalVD';
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

  const info = useMemo(() => {
    if (!pdvCodigo) return null;

    const receitaRows = (dataset?.receitaCanalVDPdv ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const receitaAtual = receitaRows.reduce((s, r) => s + r.total.receitaAtual, 0);
    const receitaVD = receitaRows.reduce((s, r) => s + r.vd.receitaAtual, 0);
    const metaPef = receitaRows.reduce((s, r) => s + r.total.metaPef, 0);
    const cidade = receitaRows[0]?.cidade ?? '';

    const monitor = dataset?.monitoramentoBase?.porPdv.find(r => r.chave === pdvCodigo) ?? null;

    const rupturaItens = (dataset?.rupturaPorItem ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const rupturaMedia = rupturaItens.length > 0 ? rupturaItens.reduce((s, r) => s + r.rupturaPct, 0) / rupturaItens.length : null;

    const sellInRows = (dataset?.sellInDetalheSku ?? []).filter(r => r.pdvCodigo === pdvCodigo);
    const sellInSugestao = sellInRows.reduce((s, r) => s + r.sugestaoComercial, 0);
    const sellInRealizado = sellInRows.reduce((s, r) => s + r.pedidoRealizado, 0);

    // Só os pedidos VD têm EstruturaPai (os OMNI vêm sem): a comparação justa é com a coluna VD da Extranet,
    // não com o Total (VD + Omni Envio ER).
    const pdvOrders = orders.filter(o => pdvForOrder(o) === pdvCodigo);
    const pedidosElegiveis = pdvOrders.filter(isRevenueEligible);
    const receitaPedidos = pedidosElegiveis.reduce((s, o) => s + o.ValorPraticado, 0);

    // Ciclo 14+: relatórios VendaDireta (GMV), base digital, opt-out e gestão de pedidos por PDV.
    const gmv = dataset?.distribuicaoReceita?.pdv.find(r => r.nome === pdvCodigo) ?? null;
    const perf = dataset?.performancePdvSupervisor?.pdv.find(r => r.nome === pdvCodigo) ?? null;
    const mix = dataset?.receitaCategoriaMix?.pdv.find(r => r.nome === pdvCodigo) ?? null;
    const mixTop = mix ? [...mix.categorias].sort((a, b) => b.participacaoPct - a.participacaoPct).slice(0, 3) : [];
    const digitais = dataset?.ferramentasDigitaisPdv?.find(r => r.pdv === pdvCodigo) ?? null;
    const optOut = dataset?.optOutPdv?.find(r => r.pdv === pdvCodigo) ?? null;
    const aderencia = dataset?.aderencia?.pdv.find(r => r.nome === pdvCodigo) ?? null;
    const colocRows = (dataset?.pedidosColocacao ?? []).filter(r => r.pdv === pdvCodigo);
    const coloc = colocRows.length > 0 ? {
      sugestao: colocRows.reduce((s, r) => s + r.volumeSugestao, 0),
      colocado: colocRows.reduce((s, r) => s + r.volumeColocado, 0),
      faturado: colocRows.reduce((s, r) => s + r.volumeFaturado, 0),
    } : null;

    return {
      cidade, receitaAtual, receitaVD, metaPef, monitor,
      rupturaMedia, rupturaCount: rupturaItens.length,
      sellInSugestao, sellInRealizado,
      pedidosCount: pdvOrders.length, receitaPedidos,
      gmv, perf, mixTop, digitais, optOut, aderencia, coloc,
    };
  }, [pdvCodigo, dataset, orders]);

  if (!pdvCodigo || !info) return null;

  const semBlocos = dataset?.receitaCanalVDPdvLayout === 'simples';
  const tipoReceita = dataset?.reportContexts.receitaCanalVDPdv?.tipoReceita;
  const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
  const secao = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>{t}</div>
  );

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

        {secao(`Receita (Extranet${tipoReceita ? ` · ${tipoReceita}` : ''})`)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {semBlocos ? (
            <div style={stat}><span style={statLabel}>Receita VD</span><span style={statValue}>{fmtBRL(info.receitaVD)}</span></div>
          ) : (
            <>
              <div style={stat}><span style={statLabel}>Receita atual (VD + Omni)</span><span style={statValue}>{fmtBRL(info.receitaAtual)}</span></div>
              <div style={stat}><span style={statLabel}>Receita VD</span><span style={statValue}>{fmtBRL(info.receitaVD)}</span></div>
            </>
          )}
          <div style={stat}><span style={statLabel}>Meta PEF</span><span style={statValue}>{info.metaPef > 0 ? fmtBRL(info.metaPef) : metaPefCanalVD(dataset) ? 'Só no total do canal' : 'Não lançada'}</span></div>
        </div>

        {(info.gmv || info.perf) && (
          <>
            {secao('Pedidos e receita GMV (relatórios VendaDireta)')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: info.mixTop.length > 0 ? 10 : 20 }}>
              {info.gmv && (
                <div style={stat}>
                  <span style={statLabel}>Receita GMV</span>
                  <span style={statValue}>{fmtBRL(info.gmv.atual)}</span>
                  <span style={{ fontSize: 11, color: info.gmv.variacaoPct >= 0 ? 'var(--vd-success, #2E7D5B)' : 'var(--vd-danger, #B83A3A)' }}>
                    {info.gmv.variacaoPct >= 0 ? '+' : ''}{info.gmv.variacaoPct.toFixed(2).replace('.', ',')}% vs. ano anterior
                  </span>
                </div>
              )}
              {info.perf && <div style={stat}><span style={statLabel}>Pedidos</span><span style={statValue}>{fmtNumber(info.perf.qtdPedidos)}</span></div>}
              {info.perf && info.perf.qtdPedidos > 0 && (
                <div style={stat}><span style={statLabel}>Pedido médio</span><span style={statValue}>{fmtBRL(info.perf.receita / info.perf.qtdPedidos)}</span></div>
              )}
            </div>
            {info.mixTop.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 20 }}>
                Mix: {info.mixTop.map(c => `${c.categoria.charAt(0) + c.categoria.slice(1).toLowerCase()} ${pct(c.participacaoPct)}`).join(' · ')}
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vd-accent, #C9A227)', marginBottom: 10 }}>Pedidos (ConsultaPedidos, PDV pela EstruturaPai)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
          <div style={stat}><span style={statLabel}>Pedidos</span><span style={statValue}>{fmtNumber(info.pedidosCount)}</span></div>
          <div style={stat}>
            <span style={statLabel}>Receita elegível (VD)</span>
            <span style={statValue}>{fmtBRL(info.receitaPedidos)}</span>
            {info.receitaVD > 0 && (
              <span style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>
                {(((info.receitaPedidos - info.receitaVD) / info.receitaVD) * 100).toFixed(2).replace('.', ',')}% vs. receita VD da Extranet
              </span>
            )}
          </div>
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

        {(info.digitais || info.optOut) && (
          <>
            {secao('Canais digitais e catálogo')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {info.digitais && info.digitais.ativas > 0 && (
                <>
                  <div style={stat}><span style={statLabel}>Ativas c/ compra digital</span><span style={statValue}>{pct((info.digitais.comCompraCanaisDigitais / info.digitais.ativas) * 100)}</span></div>
                  <div style={stat}><span style={statLabel}>Ativas c/ compra no ER</span><span style={statValue}>{pct((info.digitais.comCompraER / info.digitais.ativas) * 100)}</span></div>
                </>
              )}
              {info.optOut && <div style={stat}><span style={statLabel}>Opt-out de catálogo</span><span style={statValue}>{pct(info.optOut.pctOptOut)}</span></div>}
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

        {(info.coloc || info.aderencia) && (
          <>
            {secao('Reposição (gestão de pedidos)')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 20 }}>
              {info.coloc && info.coloc.sugestao > 0 && (
                <div style={stat}>
                  <span style={statLabel}>Colocação do pedido</span>
                  <span style={statValue}>{pct((info.coloc.colocado / info.coloc.sugestao) * 100)}</span>
                  <span style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)' }}>
                    {fmtNumber(info.coloc.colocado)} de {fmtNumber(info.coloc.sugestao)} sugeridas{info.coloc.colocado > 0 ? ` · ${pct((info.coloc.faturado / info.coloc.colocado) * 100)} faturado` : ''}
                  </span>
                </div>
              )}
              {info.aderencia && (
                <div style={stat}>
                  <span style={statLabel}>Aderência por curva</span>
                  <span style={{ ...statValue, fontSize: 14 }}>
                    {([['A', info.aderencia.curvaA], ['B', info.aderencia.curvaB], ['C', info.aderencia.curvaC], ['E', info.aderencia.curvaE]] as const)
                      .map(([c, v]) => `${c} ${v !== null ? v.toFixed(0) + '%' : '—'}`).join(' · ')}
                  </span>
                </div>
              )}
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
