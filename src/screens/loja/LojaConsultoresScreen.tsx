import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import ConsultorDetailPanel from '../../components/loja/ConsultorDetailPanel';
import PageTitle from '../../components/ui/PageTitle';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateConsultoresPorLoja, listLojasInDimension } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtNumber } from '../../utils/formatters';

type View = 'consultor' | 'operador';

const LojaConsultoresScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [view, setView] = useState<View>('consultor');
  const [lojaFiltro, setLojaFiltro] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver os consultores.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const rows = view === 'consultor' ? dataset.consultor : dataset.operador;
  const lojas = listLojasInDimension(rows);
  const agg = aggregateConsultoresPorLoja(rows, lojaFiltro || null);
  const multiLoja = agg.filter(r => r.porLoja.length > 1);

  const top = agg.slice(0, 5);
  const bottom = agg.slice(-5).reverse();

  function unidadeLabel(r: typeof agg[number]): string {
    if (r.porLoja.length === 0) return '';
    const principal = r.porLoja[0];
    return r.porLoja.length === 1 ? principal.nome : `${principal.nome} (principal)`;
  }

  function toggleExpand(nome: string) {
    setExpanded(prev => (prev === nome ? null : nome));
  }

  const renderList = (list: typeof agg, medals: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#9B9287', fontSize: 13 }}>Sem dados</div>
      ) : list.map((r, i) => {
        const isOpen = expanded === r.key;
        return (
          <div key={r.key + i}>
            <div
              onClick={() => toggleExpand(r.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '6px 8px', borderRadius: 8, transition: 'background 150ms',
                background: isOpen ? '#F2EEE2' : 'transparent',
              }}
              onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#F2EEE2'; }}
              onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: medals && i < 3 ? '#FBF3D0' : '#F2EEE2', color: medals && i < 3 ? '#8A6D00' : '#6B6258',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.key}
                    {r.porLoja.length > 0 && (
                      <span style={{ fontWeight: 400, color: '#9B9287', marginLeft: 6, fontSize: 11 }}>
                        · {unidadeLabel(r)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                    {fmtBRLshort(r.gmv)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#9B9287' }}>{fmtNumber(r.qtdBoletos)} boletos</div>
              </div>
              <i className={`ph ${isOpen ? 'ph-caret-up' : 'ph-caret-down'}`} style={{ color: '#D8D0C0', fontSize: 14, flexShrink: 0 }} />
            </div>
            {isOpen && (
              <div style={{ borderLeft: '2px solid #E8E2D6', marginLeft: 21, paddingLeft: 20 }}>
                <ConsultorDetailPanel dataset={dataset} nome={r.key} view={view} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const allSorted = [...agg].sort((a, b) => b.gmv - a.gmv);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Desempenho individual"
          hint="Ranking de GMV (valor total vendido) por consultor ou operador — clique num nome para ver o detalhe sem sair da página."
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={lojaFiltro}
            onChange={e => setLojaFiltro(e.target.value)}
            style={{
              fontSize: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid #E8E2D6',
              background: 'white', color: '#1C1814', cursor: 'pointer',
            }}
          >
            <option value="">Todas as lojas</option>
            {lojas.map(l => (
              <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nome}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6, background: '#F2EEE2', borderRadius: 10, padding: 4 }}>
            {(['consultor', 'operador'] as View[]).map(v => (
              <button
                key={v}
                className={`glossy-btn${view === v ? ' glossy-active' : ''}`}
                onClick={() => { setView(v); setExpanded(null); }}
                style={{ borderRadius: 9, fontSize: 14 }}
              >
                <GlossyContent compact>{v === 'consultor' ? 'Consultor' : 'Operador'}</GlossyContent>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="lg" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Ver top/atenção' : 'Mostrar todas'}
          </Button>
        </div>
      </div>
      <p style={{ color: '#6B6258', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
        Consultor e Operador refletem a mesma pessoa em papéis diferentes do sistema — as visões são quase idênticas.
        Clique em um nome para expandir o detalhe individual.
      </p>

      {showAll ? (
        <ChartCard
          title="Todas as pessoas"
          hint="Ranking completo por GMV — Gross Merchandise Value, o valor total vendido no ciclo — de todos os consultores/operadores, não só os 5 melhores e os 5 piores."
          subtitle={`${allSorted.length} pessoa(s) no ciclo, por GMV`}
        >
          {renderList(allSorted, true)}
        </ChartCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ChartCard
            title="Consultores que mais desempenharam"
            hint="As 5 pessoas com maior GMV (Gross Merchandise Value — valor total vendido) no ciclo atual."
            subtitle="Maior GMV no ciclo"
          >
            {renderList(top, true)}
          </ChartCard>
          <ChartCard
            title="Atenção"
            hint="As 5 pessoas com menor GMV (Gross Merchandise Value — valor total vendido) no ciclo — candidatas a apoio ou treinamento."
            subtitle="Menor GMV no ciclo"
          >
            {renderList(bottom, false)}
          </ChartCard>
        </div>
      )}

      {!lojaFiltro && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Avisos"
            hint="Pessoas que aparecem vendendo em mais de uma loja no mesmo ciclo — pode ser cobertura de folga, loja compartilhada, ou erro de lançamento."
            subtitle="Vendas efetuadas em outras unidades"
          >
            {multiLoja.length === 0 ? (
              <div style={{ color: '#6B6258', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ph ph-check-circle" style={{ color: '#2E7D5B', fontSize: 18 }} />
                Nenhum {view === 'consultor' ? 'consultor' : 'operador'} com vendas em mais de uma unidade neste ciclo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {multiLoja.map((r, i) => (
                  <div key={r.key + i} style={{ background: '#FBF3D0', border: '1px solid #E8C547', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#5C4500' }}>{r.key}</div>
                    <div style={{ fontSize: 12, color: '#7A5C00', marginTop: 4 }}>
                      Principal: <strong>{r.porLoja[0].nome}</strong> ({fmtBRLshort(r.porLoja[0].gmv)}) — também vendeu em{' '}
                      {r.porLoja.slice(1).map((l, j) => (
                        <span key={l.codigo}>
                          {j > 0 ? ', ' : ''}<strong>{l.nome}</strong> ({fmtBRLshort(l.gmv)})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaConsultoresScreen;
