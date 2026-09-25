import React, { useMemo, useState } from 'react';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/charts/ChartCard';
import RankingChart from '../components/charts/RankingChart';
import { RankingItem } from '../components/charts/RankingList';
import FloatingTooltip from '../components/ui/FloatingTooltip';
import Button from '../components/ui/Button';
import { useFilteredOrders, useOfficialVDRevenue } from '../hooks/useAnalytics';
import { useVDCorporateStore } from '../store/useVDCorporateStore';
import { isRevenueEligible } from '../analytics/financialMetrics';
import { isFVCOrder } from '../analytics/fvc';
import { pdvForOrder } from '../analytics/pdvMapping';
import { TIER_DEFINITIONS } from '../design-system/tierStyles';
import { getSupervisorColor } from '../design-system/supervisorColors';
import { fmtBRL } from '../utils/formatters';

interface FVCScreenProps {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

// Destaque (FVC) contra contexto (o restante): uma cor + neutro, os dois do tema do VD.
const FVC_COLOR = 'var(--vd-accent, #8A6D00)';
const REST_COLOR = 'var(--vd-border-strong, #D8D0C0)';

function pct(n: number): string {
  return n.toFixed(1).replace('.', ',') + '%';
}

interface Split { total: number; fvc: number }

/** Barra de parte do todo: FVC em destaque, o restante (o que a Visão geral mostra) em neutro. */
const ShareBar: React.FC<{ label: string; sublabel?: string; split: Split }> = ({ label, sublabel, split }) => {
  const [hover, setHover] = useState<'fvc' | 'rest' | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const rest = split.total - split.fvc;
  const share = split.total > 0 ? (split.fvc / split.total) * 100 : 0;

  function enter(part: 'fvc' | 'rest', e: React.MouseEvent<HTMLDivElement>) {
    setHover(part);
    setAnchor(e.currentTarget);
  }

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vd-ink, #1C1814)' }}>
          {label}
          {sublabel && <span style={{ fontWeight: 400, color: 'var(--vd-text-muted, #9B9287)', marginLeft: 8, fontSize: 12 }}>{sublabel}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
          FVC {fmtBRL(split.fvc)} · <strong style={{ color: 'var(--vd-ink, #1C1814)' }}>{pct(share)}</strong> de {fmtBRL(split.total)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 16 }}>
        {split.fvc > 0 && (
          <div
            onMouseEnter={e => enter('fvc', e)}
            onMouseLeave={() => setHover(null)}
            style={{ width: `${share}%`, minWidth: 4, background: FVC_COLOR, borderRadius: 4, opacity: hover === 'rest' ? 0.55 : 1, transition: 'opacity 120ms' }}
          />
        )}
        <div
          onMouseEnter={e => enter('rest', e)}
          onMouseLeave={() => setHover(null)}
          style={{ flex: 1, background: REST_COLOR, borderRadius: 4, opacity: hover === 'fvc' ? 0.55 : 1, transition: 'opacity 120ms' }}
        />
      </div>
      <FloatingTooltip
        anchor={anchor}
        open={hover !== null}
        style={{
          background: 'var(--loja-ink, #1C1814)', color: 'var(--loja-bg, #FAF7F2)', borderRadius: 10,
          padding: '9px 13px', fontSize: 13, lineHeight: 1.6, boxShadow: '0 4px 20px rgba(28,24,20,0.3)', whiteSpace: 'nowrap',
        }}
      >
        <div style={{ fontWeight: 600 }}>{hover === 'fvc' ? 'FVC' : 'Sem FVC (Visão geral)'} · {label}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {fmtBRL(hover === 'fvc' ? split.fvc : rest)} · {pct(split.total > 0 ? ((hover === 'fvc' ? split.fvc : rest) / split.total) * 100 : 0)}
        </div>
      </FloatingTooltip>
    </div>
  );
};

/**
 * Participação das estruturas FVC no faturamento do canal VD. É a única tela que soma o faturamento
 * total com as FVCs — a Visão geral mostra o valor sem elas (useFilteredOrders({ excludeFVC: true })),
 * e aqui "sem FVC + FVC = total" fecha com o card de receita de lá.
 */
const FVCScreen: React.FC<FVCScreenProps> = ({ onNavigate }) => {
  const orders = useFilteredOrders();
  const official = useOfficialVDRevenue();
  const corporate = useVDCorporateStore(s => s.dataset);

  const data = useMemo(() => {
    const total: Split = { total: 0, fvc: 0 };
    const byPdv: Record<string, Split> = {};
    const byStructure: Record<string, { pdv: string | null; responsaveis: Set<string>; orders: number; resellers: Set<string>; revenue: number }> = {};
    const byTier: Record<string, { revenue: number; orders: number }> = {};
    const bySupervisor: Record<string, { fvc: number; orders: number }> = {};
    let fvcOrders = 0, fvcEligible = 0;
    const fvcResellers = new Set<string>();

    for (const o of orders) {
      // Canal VD só, como a Visão geral: os pedidos OMNI (Consumidor Final) ficam fora dos dois lados.
      if (/omni/i.test(o.ModeloComercial)) continue;
      const fvc = isFVCOrder(o);
      if (fvc) fvcOrders++;
      if (!isRevenueEligible(o)) continue;
      const v = o.ValorPraticado;
      const pdv = pdvForOrder(o) ?? 'Sem PDV';
      total.total += v;
      byPdv[pdv] ??= { total: 0, fvc: 0 };
      byPdv[pdv].total += v;
      if (!fvc) continue;

      fvcEligible++;
      total.fvc += v;
      byPdv[pdv].fvc += v;
      const sup = o.ResponsavelEstrutura || 'Sem supervisor';
      bySupervisor[sup] ??= { fvc: 0, orders: 0 };
      bySupervisor[sup].fvc += v;
      bySupervisor[sup].orders++;
      if (o.Pessoa) fvcResellers.add(o.Pessoa);
      const s = (byStructure[o.Estrutura] ??= { pdv: pdvForOrder(o), responsaveis: new Set(), orders: 0, resellers: new Set(), revenue: 0 });
      s.orders++;
      s.revenue += v;
      if (o.ResponsavelEstrutura) s.responsaveis.add(o.ResponsavelEstrutura);
      if (o.Pessoa) s.resellers.add(o.Pessoa);
      byTier[o.tierId] ??= { revenue: 0, orders: 0 };
      byTier[o.tierId].revenue += v;
      byTier[o.tierId].orders++;
    }
    return { total, byPdv, byStructure, byTier, bySupervisor, fvcOrders, fvcEligible, fvcResellers: fvcResellers.size };
  }, [orders]);

  const cidadeByPdv = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of corporate?.receitaCanalVDPdv ?? []) if (r.pdvCodigo && r.cidade) map[r.pdvCodigo] = r.cidade;
    return map;
  }, [corporate]);

  if (orders.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-chart-pie-slice" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe a planilha de pedidos para ver a participação das FVCs.</p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilha</Button>
      </div>
    );
  }

  const { total, byPdv, byStructure, byTier, bySupervisor, fvcOrders, fvcEligible, fvcResellers } = data;
  const rest = total.total - total.fvc;
  const share = total.total > 0 ? (total.fvc / total.total) * 100 : 0;
  const fvcTicket = fvcEligible > 0 ? total.fvc / fvcEligible : 0;
  const pdvCodes = Object.keys(byPdv).sort();

  const structures = Object.entries(byStructure).sort((a, b) => b[1].revenue - a[1].revenue);

  const tierItems: RankingItem[] = TIER_DEFINITIONS
    .filter(t => (byTier[t.id]?.revenue ?? 0) > 0)
    .sort((a, b) => byTier[b.id].revenue - byTier[a.id].revenue)
    .map(t => ({
      label: t.name,
      value: byTier[t.id].revenue,
      valueLabel: fmtBRL(byTier[t.id].revenue),
      meta: `${byTier[t.id].orders} pedidos`,
      tierId: t.id,
    }));

  const supervisorItems: RankingItem[] = Object.entries(bySupervisor)
    .filter(([, s]) => s.fvc > 0)
    .sort((a, b) => b[1].fvc - a[1].fvc)
    .map(([name, s]) => ({
      label: name,
      value: s.fvc,
      valueLabel: fmtBRL(s.fvc),
      meta: `${pct((s.fvc / total.fvc) * 100)} das FVC`,
      color: getSupervisorColor(name)?.accent,
    }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Faturamento geral
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Participação FVC</h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 14, margin: 0, maxWidth: 760 }}>
        Pedidos das estruturas FVC e o peso delas no faturamento do canal VD. Esta é a única tela que soma o faturamento
        total com as FVCs: a Visão geral mostra o valor sem elas.
      </p>

      {total.fvc === 0 ? (
        <div style={{ marginTop: 28, padding: '32px', textAlign: 'center', color: 'var(--vd-text-secondary, #6B6258)', border: '1px dashed var(--vd-border, #E8E2D6)', borderRadius: 16 }}>
          Nenhum pedido FVC neste recorte.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
            <KpiCard
              eyebrow="Faturamento total VD*"
              value={fmtBRL(total.total)}
              footnote={official !== null ? `Com FVC · oficial do BI: ${fmtBRL(official)}` : 'Com FVC · soma dos pedidos'}
              hint="Receita (Valor Praticado) de todos os pedidos VD não cancelados do recorte, com as estruturas FVC. É a soma dos dois cards ao lado: FVC + sem FVC. O valor oficial do BI também inclui as FVCs e aparece abaixo como referência."
              tooltip={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Row label="Sem FVC (Visão geral)" value={fmtBRL(rest)} />
                  <Row label="FVC" value={fmtBRL(total.fvc)} />
                  <Row label="Total pelos pedidos" value={fmtBRL(total.total)} />
                  {official !== null && <Row label="Oficial do BI" value={fmtBRL(official)} />}
                </div>
              }
            />
            <KpiCard
              eyebrow="FVC*"
              value={fmtBRL(total.fvc)}
              footnote={`${pct(share)} do faturamento total`}
              hint="Receita dos pedidos VD não cancelados das estruturas FVC (nome da estrutura começando com 'FVC')."
            />
            <KpiCard
              eyebrow="Sem FVC*"
              value={fmtBRL(rest)}
              footnote={`${pct(100 - share)} · é o valor da Visão geral`}
              hint="Receita dos pedidos VD não cancelados fora das estruturas FVC. É o mesmo valor do card Receita VD da Visão geral."
            />
            <KpiCard
              eyebrow="Pedidos FVC*"
              value={fvcOrders.toLocaleString('pt-BR')}
              delta={fvcOrders > 0 ? pct((fvcEligible / fvcOrders) * 100) + ' fin.' : undefined}
              deltaDirection="up"
              footnote={`${fvcResellers.toLocaleString('pt-BR')} revendedores · ticket ${fmtBRL(fvcTicket)}`}
              hint="Pedidos VD das estruturas FVC no recorte, com a % de finalizados (não cancelados), os revendedores distintos com pedido finalizado e o ticket médio."
            />
          </div>

          <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--vd-text-secondary, #6B6258)', marginTop: 12 }}>
            <strong style={{ fontWeight: 600 }}>* Observação:</strong> valores do canal VD (pedidos Online e Presencial). Os pedidos
            OMNI (Consumidor Final) ficam fora, como na Visão geral. FVC são as estruturas cujo nome começa com "FVC" no
            ConsultaPedidos.
            {official !== null && (
              <>
                {' '}O valor oficial do BI ({fmtBRL(official)}) também inclui as FVCs e fica{' '}
                {fmtBRL(Math.abs(official - total.total))} ({((Math.abs(official - total.total) / official) * 100).toFixed(2).replace('.', ',')}%){' '}
                {official >= total.total ? 'acima' : 'abaixo'} da soma dos pedidos do extrato.
              </>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <ChartCard
              title="Participação no faturamento"
              subtitle="Quanto do faturamento VD vem das estruturas FVC — no total e em cada PDV"
              hint="Cada barra é 100% do faturamento VD daquele recorte. O trecho dourado é a parte das FVCs; o cinza é o restante, que é o que a Visão geral mostra."
            >
              <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: FVC_COLOR }} /> FVC
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: REST_COLOR }} /> Sem FVC (Visão geral)
                </span>
              </div>
              <ShareBar label="Total VD" split={total} />
              {pdvCodes.map(code => (
                <ShareBar
                  key={code}
                  label={code === 'Sem PDV' ? code : `PDV ${code}`}
                  sublabel={cidadeByPdv[code]}
                  split={byPdv[code]}
                />
              ))}
            </ChartCard>
          </div>

          <div style={{ marginTop: 20 }}>
            <ChartCard
              title="Estruturas FVC"
              subtitle={`${structures.length} estruturas no recorte`}
              hint="Receita dos pedidos VD não cancelados de cada estrutura FVC. '% das FVC' é a parte da estrutura dentro do total das FVCs; '% do total' é a parte dela no faturamento VD completo."
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Estrutura</th>
                      <th style={th}>PDV</th>
                      <th style={th}>Responsável</th>
                      <th style={thNum}>Pedidos</th>
                      <th style={thNum}>Revendedores</th>
                      <th style={thNum}>Receita</th>
                      <th style={thNum}>% das FVC</th>
                      <th style={thNum}>% do total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map(([name, s]) => (
                      <tr key={name}>
                        <td style={td}>{name}</td>
                        <td style={td}>{s.pdv ?? '—'}</td>
                        <td style={td}>{[...s.responsaveis].join(', ') || '—'}</td>
                        <td style={tdNum}>{s.orders.toLocaleString('pt-BR')}</td>
                        <td style={tdNum}>{s.resellers.size.toLocaleString('pt-BR')}</td>
                        <td style={tdNum}>{fmtBRL(s.revenue)}</td>
                        <td style={tdNum}>{pct((s.revenue / total.fvc) * 100)}</td>
                        <td style={tdNum}>{pct((s.revenue / total.total) * 100)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...td, fontWeight: 600 }} colSpan={3}>Total FVC</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{fvcEligible.toLocaleString('pt-BR')}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{fvcResellers.toLocaleString('pt-BR')}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{fmtBRL(total.fvc)}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>100,0%</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{pct(share)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: 'var(--vd-text-muted, #9B9287)', marginTop: 8 }}>
                Pedidos e revendedores contam só pedidos finalizados. Um revendedor que compra em mais de uma estrutura aparece em cada uma delas.
              </div>
            </ChartCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 20 }}>
            <ChartCard title="FVC por tier" subtitle="Receita FVC por segmentação do revendedor" hint="Receita dos pedidos VD não cancelados das estruturas FVC, separada pelo tier (Papel) do revendedor.">
              <RankingChart items={tierItems} mode="vd" emptyMessage="Sem dados" />
            </ChartCard>
            <ChartCard title="FVC por supervisão" subtitle="Receita FVC por responsável de estrutura" hint="Receita dos pedidos VD não cancelados das estruturas FVC, separada pelo responsável da estrutura. A % é a parte de cada supervisão dentro do total das FVCs.">
              <RankingChart items={supervisorItems} mode="vd" emptyMessage="Sem dados" />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
    <span style={{ color: 'var(--vd-text-muted, #9B9287)' }}>{label}</span>
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{value}</span>
  </div>
);

export default FVCScreen;
