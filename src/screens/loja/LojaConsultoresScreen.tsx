import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateConsultoresPorLoja, listLojasInDimension } from '../../analytics/lojaMetrics';
import { fmtBRLshort, fmtNumber } from '../../utils/formatters';

type View = 'consultor' | 'operador';

const LojaConsultoresScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const setSelectedConsultor = useLojaStore(s => s.setSelectedConsultor);
  const [view, setView] = useState<View>('consultor');
  const [lojaFiltro, setLojaFiltro] = useState<string>('');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver os consultores.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
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

  function handleClick(nome: string) {
    setSelectedConsultor({ nome, view });
    onNavigate('loja-consultor-detail');
  }

  const renderList = (list: typeof agg, medals: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#9B9287', fontSize: 13 }}>Sem dados</div>
      ) : list.map((r, i) => (
        <div
          key={r.key + i}
          onClick={() => handleClick(r.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            padding: '6px 8px', borderRadius: 8, transition: 'background 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F2EEE2')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
          <i className="ph ph-caret-right" style={{ color: '#D8D0C0', fontSize: 14, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B26A3C' }}>
            Modo Loja
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
            Desempenho individual
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={lojaFiltro}
            onChange={e => setLojaFiltro(e.target.value)}
            style={{
              fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E2D6',
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
                onClick={() => setView(v)}
                style={{ borderRadius: 8, fontSize: 13 }}
              >
                <GlossyContent compact>{v === 'consultor' ? 'Consultor' : 'Operador'}</GlossyContent>
              </button>
            ))}
          </div>
        </div>
      </div>
      <p style={{ color: '#6B6258', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
        Consultor e Operador refletem a mesma pessoa em papéis diferentes do sistema — as visões são quase idênticas.
        Clique em um nome para ver o detalhe individual.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Top performers" subtitle="Maior GMV no ciclo">
          {renderList(top, true)}
        </ChartCard>
        <ChartCard title="Atenção" subtitle="Menor GMV no ciclo">
          {renderList(bottom, false)}
        </ChartCard>
      </div>

      {!lojaFiltro && (
        <div style={{ marginTop: 20 }}>
          <ChartCard title="Avisos" subtitle="Vendas efetuadas em outras unidades">
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
