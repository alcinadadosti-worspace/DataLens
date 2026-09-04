import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { pedidosRates, classifyAbc, buildLojaNomeLookup } from '../../analytics/lojaMetrics';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { fmtNumber, fmtPct } from '../../utils/formatters';

const LojaPedidosScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [groupBy, setGroupBy] = useState<'loja' | 'categoria'>('loja');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver a gestão de pedidos.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!dataset.pedidosHistorico || dataset.pedidosHistorico.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          O arquivo <strong>GestaoPedidos_Historico_Colocacao_Pedido</strong> não foi importado — gestão de pedidos indisponível.
        </p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar arquivo</Button>
      </div>
    );
  }

  const lojaNomeLookup = buildLojaNomeLookup(dataset.lojas);
  const rates = pedidosRates(dataset.pedidosHistorico, groupBy, lojaNomeLookup);
  const visaoGeral = dataset.pedidosVisaoGeral?.[0];
  const giroCanais = dataset.pedidosGiroCanais ?? [];

  // Risco: categoria com item Classe A na curva ABC e baixa taxa de atendimento.
  const classeARisco = groupBy === 'categoria' && dataset.abc
    ? (() => {
        const abcClassA = new Set(classifyAbc(dataset.abc).filter(a => a.classe === 'A').map(a => a.codigo));
        const skusPorCategoria = new Map<string, Set<string>>();
        for (const r of dataset.pedidosHistorico!) {
          const cat = r.categoria ?? 'Sem categoria';
          if (!skusPorCategoria.has(cat)) skusPorCategoria.set(cat, new Set());
          skusPorCategoria.get(cat)!.add(r.sku);
        }
        return rates.filter(r => {
          const skus = skusPorCategoria.get(r.key);
          const temClasseA = skus && Array.from(skus).some(sku => abcClassA.has(sku));
          return temClasseA && r.taxaAtendimentoPct < 80;
        });
      })()
    : [];

  const items = rates.slice(0, 20).map(r => ({
    label: r.key,
    value: r.volumeColocado,
    valueLabel: fmtNumber(r.volumeColocado),
    meta: `Coloc. ${r.taxaColocacaoPct.toFixed(0)}% · Atend. ${r.taxaAtendimentoPct.toFixed(0)}%`,
  }));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <PageTitle
        eyebrow="Modo Loja"
        title="Gestão de pedidos e reposição"
        hint="Acompanha o ciclo de reposição de estoque: quanto foi sugerido pedir, quanto foi de fato colocado no pedido, e quanto o fornecedor faturou (entregou)."
      />
      <div style={{ marginBottom: 24 }} />

      {visaoGeral && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
              Meta sugestão
              <InfoHint text="Volume que o sistema sugeriu pedir no ciclo, com base no histórico de vendas e estoque." />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNumber(visaoGeral.metaSugestao)}</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
              Volume colocado
              <InfoHint text="Volume que de fato foi pedido ao fornecedor, podendo diferir da sugestão do sistema." />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNumber(visaoGeral.volumeColocado)}</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
              Volume faturado
              <InfoHint text="Volume que o fornecedor efetivamente entregou/faturou do que foi colocado no pedido." />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNumber(visaoGeral.volumeFaturado)}</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E8E2D6', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#9B9287', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
              Giro do ciclo
              <InfoHint text="Indicador de giro de estoque do ciclo — quão rápido o estoque reposto foi vendido." />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtPct(visaoGeral.giro)}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant={groupBy === 'loja' ? 'primary' : 'ghost'} onClick={() => setGroupBy('loja')}>Por loja</Button>
        <Button variant={groupBy === 'categoria' ? 'primary' : 'ghost'} onClick={() => setGroupBy('categoria')}>Por categoria</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <ChartCard
          title={`Taxa de colocação e atendimento — ${groupBy === 'loja' ? 'por loja' : 'por categoria'}`}
          hint="Colocação: % do volume sugerido que de fato foi pedido. Atendimento: % do volume pedido que o fornecedor entregou. Volume ordenado do maior colocado ao menor."
          subtitle="Colocação = Colocado/Sugestão · Atendimento = Faturado/Colocado"
        >
          <RankingChart items={items} medals={false} />
        </ChartCard>

        <ChartCard
          title="Giro — Geral vs. Loja"
          hint="Compara o giro de estoque da rede toda (todos os canais de venda) com o giro apenas do canal loja física."
          subtitle="Rede toda (todos os canais) vs. só o canal físico"
        >
          {giroCanais.length === 0 ? (
            <div style={{ color: '#9B9287', fontSize: 13 }}>Arquivo de giro por canal não importado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {giroCanais.map((g, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F2EEE2', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{g.escopo}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                    Giro {fmtPct(g.giroPct)} · {fmtNumber(g.volumeFaturado)}/{fmtNumber(g.volumePedido)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {groupBy === 'categoria' && classeARisco.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Risco de ruptura"
            hint="Categorias que contêm produto Classe A (essencial no faturamento, ver Curva ABC) e baixa taxa de atendimento do fornecedor — risco real de faltar produto importante em loja."
            subtitle="Categoria com produto Classe A e baixa taxa de atendimento do fornecedor"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classeARisco.map((r, i) => (
                <div key={i} style={{ background: '#FBE5E9', border: '1px solid #F0A8B3', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#5C0F1A' }}>{r.key}</div>
                  <div style={{ fontSize: 12, color: '#8A1426', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    Taxa de atendimento {r.taxaAtendimentoPct.toFixed(0)}% — contém produto de Classe A
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaPedidosScreen;
