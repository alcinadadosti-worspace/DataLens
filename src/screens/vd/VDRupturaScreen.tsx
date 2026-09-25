import React, { useMemo } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import TierDonutChart from '../../components/charts/TierDonutChart';
import Button from '../../components/ui/Button';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtNumber } from '../../utils/formatters';
import { exportToCSV } from '../../services/exportService';
import GlossarioPanel from './GlossarioPanel';

/** Normaliza nome de produto pra cruzar RupturaVD_detalhamento_ruptura_por_item (coluna SKU, na
 * verdade uma descrição de texto) com ConsultaRankingVendas (NomeProduto) — os dois arquivos não
 * compartilham um código de SKU comum nesta amostra, só o nome por extenso, então o match é por
 * igualdade de texto normalizado (maiúsculas, sem espaço duplicado) — melhor esforço, não garantido. */
function normalizeProdName(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

const VDRupturaScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const resumo = dataset?.rupturaDetalhada ?? dataset?.rupturaCausaFranqueado;
  const itens = dataset?.rupturaPorItem ?? [];

  // Cruzamento com ConsultaRankingVendas: quanto desse produto foi de fato vendido no ciclo,
  // pra priorizar ruptura em itens que vendem muito (não só o % de ruptura isolado).
  const vendasPorProduto = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of dataset?.rankingVendas ?? []) {
      if (r.tipo !== 'Venda') continue;
      const key = normalizeProdName(r.nomeProduto);
      map.set(key, (map.get(key) ?? 0) + r.quantidadeItens);
    }
    return map;
  }, [dataset?.rankingVendas]);

  if (!resumo && itens.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-warning-octagon" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de ruptura</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe os relatórios RupturaVD para ver indisponibilidade de produto por causa e por item.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const franqueadoPct = resumo?.rupturaCausaFranqueadoPct ?? 0;
  const industriaPct = resumo?.rupturaCausaIndustriaPct ?? 0;
  const totalPct = resumo?.rupturaTotalPct ?? (franqueadoPct + industriaPct);

  const donutData = [
    { tierId: 'ruptura-franqueado', value: franqueadoPct, label: 'Causa franqueado', color: 'var(--vd-warning-strong, #C9A227)' },
    { tierId: 'ruptura-industria', value: industriaPct, label: 'Causa indústria', color: 'var(--vd-danger, #B83A3A)' },
  ].filter(d => d.value > 0);

  const topItens = [...itens].slice(0, 30);

  function exportItens() {
    exportToCSV(
      itens.map(r => ({
        Ciclo: r.ciclo, PDV: r.pdvCodigo, Canal: r.canal, SKU: r.sku,
        'Volume de Itens': r.volumeItens, Causa: r.causaRuptura, '% Ruptura': r.rupturaPct,
        'Vendas no ciclo (un.)': vendasPorProduto.get(normalizeProdName(r.sku)) ?? '',
      })),
      `datalens-ruptura-item-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 28px' }}>Ruptura</h1>

      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            eyebrow="Ruptura total no ciclo"
            value={`${totalPct.toFixed(2).replace('.', ',')}%`}
            deltaDirection={totalPct > 5 ? 'down' : 'up'}
            hint="Coluna '% RUPTURA TOTAL NO CICLO' de RupturaVD_Ruptura_detalhada_ciclo.xlsx (aba CICLO, 1 linha) — já vem calculada pelo sistema de origem, não somamos franqueado + indústria nós mesmos."
          />
          <KpiCard
            eyebrow="Causa franqueado"
            value={`${franqueadoPct.toFixed(2).replace('.', ',')}%`}
            hint="Coluna '% RUPTURA CF (IAF)' de RupturaVD_Ruptura_detalhada_ciclo.xlsx — mesmo número que aparece em RupturaVD_Ruptura_causa_franqueado.xlsx (arquivo dedicado, usado como fallback se o detalhado não vier). Ruptura atribuível a falta de pedido/reposição do próprio franqueado."
          />
          <KpiCard
            eyebrow="Causa indústria"
            value={`${industriaPct.toFixed(2).replace('.', ',')}%`}
            hint="Coluna '% RUPTURA CAUSA INDUSTRIA' de RupturaVD_Ruptura_detalhada_ciclo.xlsx — falta de estoque na indústria, fora do controle do franqueado. Normalmente é a maior parte da ruptura total."
          />
        </div>
      )}

      {donutData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ChartCard
            title="Composição da ruptura"
            subtitle="Franqueado vs. indústria"
            hint="Mesmas duas colunas dos KPIs acima ('% RUPTURA CF (IAF)' e '% RUPTURA CAUSA INDUSTRIA'), só que lado a lado num donut para comparar visualmente a proporção — nenhum recálculo além do que o arquivo já traz."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <TierDonutChart data={donutData} size={160} centerLabel="Total" centerValue={`${totalPct.toFixed(1).replace('.', ',')}%`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {donutData.map(d => (
                  <div key={d.tierId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                    <span style={{ fontSize: 13 }}>{d.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>{d.value.toFixed(2).replace('.', ',')}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>
      )}

      {itens.length > 0 && (
        <ChartCard
          title="Detalhamento por item"
          subtitle="Amostra de SKUs monitorados — não é o catálogo completo de produtos"
          hint="RupturaVD_detalhamento_ruptura_por_item.xlsx, aba CICLO — uma linha por SKU × PDV, colunas 'VOLUME DE ITENS', 'CAUSA RUPTURA' e '% DE RUPTURA' lidas direto, ordenadas aqui por % de ruptura (maior primeiro). Este arquivo lista só os SKUs monitorados/críticos, não todo o catálogo (que tem milhares de itens) — não trate como universo completo de ruptura. A coluna 'Vendas no ciclo' cruza com ConsultaRankingVendas.csv por nome de produto normalizado (não há código de SKU em comum entre os dois arquivos) — melhor esforço, fica vazia quando não encontra correspondência exata."
          action={
            <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportItens}>
              Exportar CSV
            </Button>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>PDV</th>
                  <th style={th}>Canal</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: 'right' }}>Volume de itens</th>
                  <th style={th}>Causa</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Ruptura</th>
                  <th style={{ ...th, textAlign: 'right' }}>Vendas no ciclo</th>
                </tr>
              </thead>
              <tbody>
                {topItens.map((r, i) => {
                  const vendas = vendasPorProduto.get(normalizeProdName(r.sku));
                  const prioridade = r.rupturaPct > 0 && !!vendas && vendas > 0;
                  return (
                    <tr key={i} style={prioridade ? { background: 'var(--vd-warning-bg, #FBF3D0)' } : undefined}>
                      <td style={td}>{r.pdvCodigo}</td>
                      <td style={td}>{r.canal}</td>
                      <td style={{ ...td, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sku}>
                        {r.sku}
                        {prioridade && <i className="ph ph-bold ph-fire" title="Rompe e vende — prioridade de reposição" style={{ marginLeft: 6, color: 'var(--vd-danger, #B83A3A)', fontSize: 12 }} />}
                      </td>
                      <td style={tdNum}>{fmtNumber(r.volumeItens)}</td>
                      <td style={td}>{r.causaRuptura === '-' ? '—' : r.causaRuptura}</td>
                      <td style={{ ...tdNum, color: r.rupturaPct > 0 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-text-secondary, #6B6258)', fontWeight: r.rupturaPct > 0 ? 600 : 400 }}>
                        {r.rupturaPct.toFixed(2).replace('.', ',')}%
                      </td>
                      <td style={tdNum}>{vendas !== undefined ? fmtNumber(vendas) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <div style={{ marginTop: 20 }}>
        <GlossarioPanel termos={['iaf']} />
      </div>
    </div>
  );
};

export default VDRupturaScreen;
