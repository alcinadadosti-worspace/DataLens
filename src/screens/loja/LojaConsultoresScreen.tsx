import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  // Hooks ficam antes do guard "sem dados" abaixo (ordem estável entre renders); `rows` cai pra
  // array vazio sem dataset, então os memos abaixo continuam seguros de chamar incondicionalmente.
  // Memoizado por `rows`/`lojaFiltro` — sem isso, expandir/recolher um card (a interação mais
  // frequente da tela, via `toggleExpand`/`setExpanded`) reprocessava o dataset inteiro à toa, já
  // que `expanded` não entra em nenhuma dessas dependências.
  const rows = dataset ? (view === 'consultor' ? dataset.consultor : dataset.operador) : [];
  const lojas = useMemo(() => listLojasInDimension(rows), [rows]);
  const agg = useMemo(() => aggregateConsultoresPorLoja(rows, lojaFiltro || null), [rows, lojaFiltro]);
  const multiLoja = useMemo(() => agg.filter(r => r.porLoja.length > 1), [agg]);

  const top = useMemo(() => agg.slice(0, 5), [agg]);
  const bottom = useMemo(() => agg.slice(-5).reverse(), [agg]);
  const allSorted = useMemo(() => [...agg].sort((a, b) => b.gmv - a.gmv), [agg]);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver os consultores.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

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
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>Sem dados</div>
      ) : list.map((r, i) => {
        const isOpen = expanded === r.key;
        return (
          <div key={r.key + i}>
            <motion.div
              onClick={() => toggleExpand(r.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '6px 8px', borderRadius: 8,
                background: isOpen ? 'var(--loja-bg-subtle, #F2EEE2)' : 'transparent',
              }}
              whileHover={{ backgroundColor: 'var(--loja-bg-subtle, #F2EEE2)', x: 2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: medals && i < 3 ? 'var(--loja-warning-bg, #FBF3D0)' : 'var(--loja-bg-subtle, #F2EEE2)', color: medals && i < 3 ? 'var(--loja-warning-text-strong, #8A6D00)' : 'var(--loja-text-secondary, #6B6258)',
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
                      <span style={{ fontWeight: 400, color: 'var(--loja-text-muted, #9B9287)', marginLeft: 6, fontSize: 11 }}>
                        · {unidadeLabel(r)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                    {fmtBRLshort(r.gmv)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)' }}>{fmtNumber(r.qtdBoletos)} boletos</div>
              </div>
              <motion.i
                className="ph ph-caret-down"
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: 'inline-block', color: 'var(--loja-border-strong, #D8D0C0)', fontSize: 14, flexShrink: 0 }}
              />
            </motion.div>
            {/*
              Sem animar "height" aqui de propósito: o conteúdo expandido pode ter até 4 gráficos
              (RankingChart/recharts inclusos), e animar a altura do contêiner força recálculo de
              layout a cada frame — combinado com o ResizeObserver do recharts reagindo a esse
              contêiner mudando de tamanho em tempo real, isso derrubava bastante o FPS. Só opacity
              (sem exit também, pra não re-renderizar o conteúdo pesado ao fechar).
            */}
            {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <div style={{ borderLeft: '2px solid var(--loja-border, #E8E2D6)', marginLeft: 21, paddingLeft: 20 }}>
                    <ConsultorDetailPanel dataset={dataset} nome={r.key} view={view} />
                  </div>
                </motion.div>
              )}
          </div>
        );
      })}
    </div>
  );

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
              fontSize: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--loja-border, #E8E2D6)',
              background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)', cursor: 'pointer',
            }}
          >
            <option value="">Todas as lojas</option>
            {lojas.map(l => (
              <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nome}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6, background: 'var(--loja-bg-subtle, #F2EEE2)', borderRadius: 10, padding: 4 }}>
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
      <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 13, marginTop: 4, marginBottom: 24 }}>
        Consultor e Operador refletem a mesma pessoa em papéis diferentes do sistema — as visões são quase idênticas.
        Clique em um nome para expandir o detalhe individual.
      </p>

      <AnimatePresence mode="wait">
        {showAll ? (
          <motion.div
            key="all"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <ChartCard glow
              title="Todas as pessoas"
              hint="Ranking completo por GMV — Gross Merchandise Value, o valor total vendido no ciclo — de todos os consultores/operadores, não só os 5 melhores e os 5 piores."
              subtitle={`${allSorted.length} pessoa(s) no ciclo, por GMV`}
            >
              {renderList(allSorted, true)}
            </ChartCard>
          </motion.div>
        ) : (
          <motion.div
            key="topbottom"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
          >
            <ChartCard glow
              title="Consultores que mais desempenharam"
              hint="As 5 pessoas com maior GMV (Gross Merchandise Value — valor total vendido) no ciclo atual."
              subtitle="Maior GMV no ciclo"
            >
              {renderList(top, true)}
            </ChartCard>
            <ChartCard glow
              title="Atenção"
              hint="As 5 pessoas com menor GMV (Gross Merchandise Value — valor total vendido) no ciclo — candidatas a apoio ou treinamento."
              subtitle="Menor GMV no ciclo"
            >
              {renderList(bottom, false)}
            </ChartCard>
          </motion.div>
        )}
      </AnimatePresence>

      {!lojaFiltro && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Avisos"
            hint="Pessoas que aparecem vendendo em mais de uma loja no mesmo ciclo — pode ser cobertura de folga, loja compartilhada, ou erro de lançamento."
            subtitle="Vendas efetuadas em outras unidades"
          >
            {multiLoja.length === 0 ? (
              <div style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ph ph-check-circle" style={{ color: 'var(--loja-success, #2E7D5B)', fontSize: 18 }} />
                Nenhum {view === 'consultor' ? 'consultor' : 'operador'} com vendas em mais de uma unidade neste ciclo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {multiLoja.map((r, i) => (
                  <div key={r.key + i} style={{ background: 'var(--loja-warning-bg, #FBF3D0)', border: '1px solid var(--loja-warning-border, #E8C547)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--loja-warning-text, #5C4500)' }}>{r.key}</div>
                    <div style={{ fontSize: 12, color: 'var(--loja-warning-text-strong, #7A5C00)', marginTop: 4 }}>
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
