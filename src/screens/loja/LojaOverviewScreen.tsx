import React from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { useLojaStore } from '../../store/useLojaStore';
import { computeOverallKPIs, rankLojas, consistencyCheck, crossInsights, optionalConsistencyWarnings } from '../../analytics/lojaMetrics';
import { fmtBRL, fmtBRLshort, fmtNumber, fmtPct } from '../../utils/formatters';

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
        <Button variant="primary" size="lg" icon={<i className="ph ph-upload-simple" style={{ fontSize: 18 }} />} onClick={() => onNavigate('loja-import')}>
          Importar dados
        </Button>
      </div>
    );
  }

  const kpis = computeOverallKPIs(dataset.lojas);
  const ranking = rankLojas(dataset.lojas);
  const consistency = consistencyCheck(dataset);
  const insights = crossInsights(dataset);
  const optionalWarnings = optionalConsistencyWarnings(dataset);
  const receitaTotalIndicador = dataset.resumoPerformance?.cp?.find(i => i.indicador.toUpperCase().includes('RECEITA TOTAL'));

  const rankingItems = ranking.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${r.participacaoPct.toFixed(1).replace('.', ',')}% · ${fmtNumber(r.qtdBoletos)} boletos`,
  }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Ranking geral"
          hint="Visão consolidada de todas as lojas da rede no ciclo importado — GMV, ticket médio e indicadores cruzados entre os arquivos."
        />
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
          <InfoHint text="Compara o GMV somado pelo arquivo de Lojas com o GMV somado pelos arquivos de Canal, Gestão e Forma de pagamento — todos deveriam bater, já que são o mesmo total visto por recortes diferentes." />
        </div>
      </div>

      {receitaTotalIndicador && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginTop: 20 }}>
          {receitaTotalIndicador.vsMetaPEFPct !== null && (
            <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Receita vs. Meta PEF
                <InfoHint text="PEF é a metodologia de meta usada internamente pelo sistema de origem (Resumo de Performance). Este indicador compara a receita realizada contra a meta PEF definida para o ciclo." />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: receitaTotalIndicador.vsMetaPEFPct >= 0 ? '#2E7D5B' : '#B83A3A' }}>{fmtPct(receitaTotalIndicador.vsMetaPEFPct)}</div>
              {receitaTotalIndicador.metaPEF !== null && (
                <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2 }}>Meta: {fmtBRL(receitaTotalIndicador.metaPEF)}</div>
              )}
            </div>
          )}
          {receitaTotalIndicador.vsAnoPassadoPct !== null && (
            <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Receita vs. Ano anterior
                <InfoHint text="Comparação da receita deste ciclo com o mesmo período do ano anterior." />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: receitaTotalIndicador.vsAnoPassadoPct >= 0 ? '#2E7D5B' : '#B83A3A' }}>{fmtPct(receitaTotalIndicador.vsAnoPassadoPct)}</div>
            </div>
          )}
        </div>
      )}

      {(kpis.fidelidadePenetracaoPctGeral > 0 || dataset.fidelidade || dataset.cuidadosFaciais) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20 }}>
          {kpis.fidelidadePenetracaoPctGeral > 0 && (
            <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Boletos de cliente Fidelidade
                <InfoHint text="% dos boletos (cupons de venda) que pertencem a clientes cadastrados no programa Fidelidade — dado que já vinha nos CSVs obrigatórios, mas não era exibido em nenhuma tela." />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{kpis.fidelidadePenetracaoPctGeral.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2 }}>média ponderada por boletos, {fmtNumber(kpis.qtdBoletosTotal)} boletos no ciclo</div>
            </div>
          )}
          {dataset.fidelidade && dataset.fidelidade.cp.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                % que concluiu o desafio Fidelidade
                <InfoHint text="Dos boletos de cliente Fidelidade, quantos concluíram o 'desafio' do programa (uma ação/meta específica) — vem do arquivo ProgramaFidelidade." />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{dataset.fidelidade.cp[0].penetracaoPct.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2 }}>dentre os boletos de cliente Fidelidade</div>
            </div>
          )}
          {dataset.cuidadosFaciais && dataset.cuidadosFaciais.participacaoPct !== null && (
            <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Cuidados Faciais + Botik no GMV
                <InfoHint text="GMV — Gross Merchandise Value (valor total transacionado). % do GMV da rede que veio dos produtos da linha Botik e da categoria Cuidados Faciais." />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{dataset.cuidadosFaciais.participacaoPct.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 11, color: '#9B9287', marginTop: 2 }}>do GMV total da rede no ciclo</div>
            </div>
          )}
        </div>
      )}

      {optionalWarnings.length > 0 && (
        <div style={{ background: '#FBF3D0', border: '1px solid #E8C547', borderRadius: 10, padding: '10px 16px', marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4500', marginBottom: 6 }}>
            {optionalWarnings.length} divergência(s) entre arquivos opcionais
          </div>
          {optionalWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: '#5C4500', marginTop: 4 }}>{w}</div>
          ))}
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 28 }}>
        <KpiCard
          eyebrow="GMV do grupo"
          hint="GMV — Gross Merchandise Value: valor total vendido por toda a rede no ciclo, antes de descontos e trocas."
          value={fmtBRLshort(kpis.gmvTotal)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.gmvTotal)}</span>}
        />
        <KpiCard
          eyebrow="Ticket médio geral"
          hint="GMV total dividido pela quantidade de boletos — o valor médio de cada venda fechada na rede."
          value={fmtBRLshort(kpis.ticketMedioGeral)}
          meta={`${fmtNumber(kpis.qtdBoletosTotal)} boletos`}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.ticketMedioGeral)}</span>}
        />
        <KpiCard
          eyebrow="Receita líquida"
          hint="Receita já descontando trocas e devoluções — o valor que efetivamente ficou com a rede."
          value={fmtBRLshort(kpis.receitaLiquidaTotal)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(kpis.receitaLiquidaTotal)}</span>}
        />
        <KpiCard
          eyebrow="% Desconto sobre receita"
          hint="Total de descontos concedidos dividido pela receita líquida — quanto do valor vendido foi abatido em desconto."
          value={kpis.descontoPctGeral.toFixed(1).replace('.', ',') + '%'}
          meta={fmtBRL(kpis.totalDescontosTotal)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 24 }}>
        <ChartCard
          title="Ranking de lojas"
          hint="Todas as lojas da rede ordenadas por GMV (Gross Merchandise Value) no ciclo, da que mais vendeu até a que menos vendeu."
          subtitle="Por GMV — 1º ao último lugar"
        >
          <RankingChart items={rankingItems} />
        </ChartCard>

        <ChartCard
          title="Leitura cruzada"
          hint="Insights automáticos conectando as diferentes dimensões dos dados (canal, forma de pagamento, categoria, lojas e os arquivos opcionais importados)."
          subtitle="Insights conectando as dimensões"
        >
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
