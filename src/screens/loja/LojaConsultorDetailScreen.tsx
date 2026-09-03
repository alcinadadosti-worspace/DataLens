import React from 'react';
import ChartCard from '../../components/charts/ChartCard';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName, buildLojaNomeLookup, hourlyDistribution } from '../../analytics/lojaMetrics';
import { fmtBRL, fmtBRLshort, fmtNumber } from '../../utils/formatters';

const LojaConsultorDetailScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const selected = useLojaStore(s => s.selectedConsultor);

  if (!dataset || !selected) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Nenhum consultor selecionado.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-consultores')}>Voltar</Button>
      </div>
    );
  }

  const rows = selected.view === 'consultor' ? dataset.consultor : dataset.operador;
  const agg = aggregateByName(rows).find(r => r.key === selected.nome);
  const lojaNomeLookup = buildLojaNomeLookup(dataset.lojas);

  if (!agg) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Não foi possível encontrar dados para "{selected.nome}".</p>
        <Button variant="primary" onClick={() => onNavigate('loja-consultores')}>Voltar</Button>
      </div>
    );
  }

  const lojaCodigo = agg.lojaCodigos.length === 1 ? agg.lojaCodigos[0] : null;
  const lojaNome = lojaCodigo ? lojaNomeLookup.get(lojaCodigo) : null;
  const horaRows = lojaCodigo && dataset.vendaPorHora ? dataset.vendaPorHora.filter(r => r.lojaCodigo === lojaCodigo) : [];
  const buckets = horaRows.length > 0 ? hourlyDistribution(horaRows) : [];
  const maxBucket = buckets.length > 0 ? Math.max(...buckets.map(b => b.receitaLiquida), 1) : 1;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <button
        onClick={() => onNavigate('loja-consultores')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6B6258', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}
      >
        <i className="ph ph-arrow-left" /> Voltar para consultores
      </button>

      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
        Modo Loja · {selected.view === 'consultor' ? 'Consultor' : 'Operador'}
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
        {selected.nome}
      </h1>
      {agg.lojaCodigos.length > 0 && (
        <p style={{ color: '#6B6258', fontSize: 13, marginTop: 6 }}>
          Unidade{agg.lojaCodigos.length > 1 ? 's' : ''}: {agg.lojaCodigos.map(c => `${c}${lojaNomeLookup.get(c) ? ' - ' + lojaNomeLookup.get(c) : ''}`).join(', ')}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 24 }}>
        <KpiCard
          eyebrow="GMV no ciclo"
          value={fmtBRLshort(agg.gmv)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(agg.gmv)}</span>}
        />
        <KpiCard
          eyebrow="Boletos"
          value={fmtNumber(agg.qtdBoletos)}
        />
        <KpiCard
          eyebrow="Ticket médio"
          value={fmtBRLshort(agg.ticketMedio)}
          tooltip={<span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{fmtBRL(agg.ticketMedio)}</span>}
        />
        <KpiCard
          eyebrow="% Desconto sobre receita"
          value={agg.descontoPct.toFixed(1).replace('.', ',') + '%'}
          meta={fmtBRL(agg.totalDescontos)}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Padrão de horário"
          subtitle={
            lojaCodigo
              ? `Loja ${lojaCodigo}${lojaNome ? ' - ' + lojaNome : ''} — não é possível segmentar por vendedor individual`
              : 'Indisponível'
          }
        >
          {!lojaCodigo ? (
            <div style={{ color: '#9B9287', fontSize: 13, lineHeight: 1.6 }}>
              Este {selected.view === 'consultor' ? 'consultor' : 'operador'} aparece em {agg.lojaCodigos.length} lojas diferentes
              no período, então não há uma única loja para mostrar o padrão de horário.
            </div>
          ) : buckets.length === 0 ? (
            <div style={{ color: '#9B9287', fontSize: 13, lineHeight: 1.6 }}>
              O arquivo <strong>relatorioVendaPorHora</strong> não foi importado, ou não tem dados para essa loja.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {buckets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 64, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#6B6258', flexShrink: 0 }}>
                      {b.faixaHoraria}
                    </div>
                    <div style={{ flex: 1, height: 18, borderRadius: 6, background: '#F2EEE6', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.max((b.receitaLiquida / maxBucket) * 100, 1.5)}%`, borderRadius: 6,
                        background: '#B26A3C',
                      }} />
                    </div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                      {fmtBRLshort(b.receitaLiquida)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9B9287', marginTop: 12, lineHeight: 1.5 }}>
                Este é o padrão de horário <strong>da loja inteira</strong> (todos os vendedores), mostrado como contexto —
                os arquivos de origem não trazem venda por hora quebrada por consultor/operador individual, então não é
                possível isolar só as vendas de {selected.nome} por faixa horária.
              </div>
            </>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaConsultorDetailScreen;
