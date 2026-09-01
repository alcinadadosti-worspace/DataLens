import React from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import RankingList from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { computeOverallKPIs, rankLojas, consistencyCheck, crossInsights } from '../../analytics/lojaMetrics';
import { fmtBRL, fmtBRLshort, fmtNumber } from '../../utils/formatters';

interface LojaOverviewScreenProps {
  onNavigate: (route: string) => void;
}

const LojaOverviewScreen: React.FC<LojaOverviewScreenProps> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: '#D8D0C0', marginBottom: 16 }}>
          <i className="ph ph-storefront" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Nenhum dado importado</h2>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          Importe os 7 arquivos CSV do relatório gerencial para ver o ranking.
        </p>
        <Button variant="primary" icon={<i className="ph ph-upload-simple" style={{ fontSize: 16 }} />} onClick={() => onNavigate('loja-import')}>
          Importar dados
        </Button>
      </div>
    );
  }

  const kpis = computeOverallKPIs(dataset.lojas);
  const ranking = rankLojas(dataset.lojas);
  const consistency = consistencyCheck(dataset);
  const insights = crossInsights(dataset);

  const rankingItems = ranking.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${r.participacaoPct.toFixed(1).replace('.', ',')}% · ${fmtNumber(r.qtdBoletos)} boletos`,
  }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Ranking geral
          </h1>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: consistency.ok ? '#2E7D5B' : '#B83A3A',
          background: consistency.ok ? '#E0F2E8' : '#FBE5E9',
          padding: '5px 10px', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace',
        }}>
          <i className={consistency.ok ? 'ph-bold ph-check-circle' : 'ph-bold ph-warning-circle'} />
          {consistency.ok
            ? 'Consistência verificada entre cortes'
            : `Divergência de ${consistency.maxDiffPct.toFixed(1)}% entre cortes`}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="GMV do grupo"
          value={fmtBRLshort(kpis.gmvTotal)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.gmvTotal)}</span>}
        />
        <KpiCard
          eyebrow="Ticket médio geral"
          value={fmtBRLshort(kpis.ticketMedioGeral)}
          meta={`${fmtNumber(kpis.qtdBoletosTotal)} boletos`}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.ticketMedioGeral)}</span>}
        />
        <KpiCard
          eyebrow="Receita líquida"
          value={fmtBRLshort(kpis.receitaLiquidaTotal)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.receitaLiquidaTotal)}</span>}
        />
        <KpiCard
          eyebrow="% Desconto sobre receita"
          value={kpis.descontoPctGeral.toFixed(1).replace('.', ',') + '%'}
          meta={fmtBRL(kpis.totalDescontosTotal)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 24 }}>
        <ChartCard title="Ranking de lojas" subtitle="Por GMV — 1º ao último lugar">
          <RankingList items={rankingItems} />
        </ChartCard>

        <ChartCard title="Leitura cruzada" subtitle="Insights conectando as dimensões">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {insights.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.5 }}>
                <i className="ph ph-lightbulb" style={{ color: '#C9A227', fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <span>{text}</span>
              </div>
            ))}
            {insights.length === 0 && (
              <div style={{ color: '#9B9287', fontSize: 13 }}>Sem insights disponíveis.</div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaOverviewScreen;
