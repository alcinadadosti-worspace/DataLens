import React, { useMemo, useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { useLojaStore } from '../../store/useLojaStore';
import {
  rankLojas, aggregateByName, classifyAbcByLoja, pedidosRates, buildLojaNomeLookup,
  logisticaAdesaoResumoPorPdv, sellInSkuRanking,
} from '../../analytics/lojaMetrics';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { fmtBRL, fmtBRLshort, fmtNumber, fmtPct } from '../../utils/formatters';

function StatRow({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', padding: '8px 0' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{value}</span>
        {meta && <span style={{ color: 'var(--loja-text-muted, #9B9287)', marginLeft: 8, fontSize: 11 }}>{meta}</span>}
      </span>
    </div>
  );
}

function MiniList({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  if (items.length === 0) return <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>Sem dados.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 7 }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>{it.label}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)', flexShrink: 0 }}>
            {it.value}{it.sub && <span style={{ color: 'var(--loja-text-muted, #9B9287)', marginLeft: 6 }}>{it.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const LojaPerfilScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const ranking = useMemo(() => dataset ? rankLojas(dataset.lojas) : [], [dataset]);
  const [codigoSel, setCodigoSel] = useState<string>('');

  const codigo = codigoSel || ranking[0]?.lojaCodigos[0] || '';

  const perfil = useMemo(() => {
    if (!dataset || !codigo) return null;

    const lojaRow = dataset.lojas.find(r => r.lojaCodigo === codigo);
    const nome = resolveLojaNome(codigo, lojaRow?.quebraNome ?? codigo);

    const canais = aggregateByName(dataset.canal, true, codigo).slice(0, 5);
    const formas = aggregateByName(dataset.forma, true, codigo).slice(0, 5);
    const categorias = aggregateByName(dataset.gestao, true, codigo).slice(0, 6);

    const abcByLoja = dataset.abc ? classifyAbcByLoja(dataset.abc) : null;
    const abcEntry = abcByLoja ? Array.from(abcByLoja.entries()).find(([key]) => key.startsWith(`${codigo} -`)) : null;
    const topProdutos = abcEntry ? abcEntry[1].slice(0, 6) : [];

    const lojaNomeLookup = buildLojaNomeLookup(dataset.lojas);
    const pedidosDaLoja = dataset.pedidosHistorico?.filter(r => r.lojaCodigo === codigo) ?? [];
    const pedidosPorCategoria = pedidosDaLoja.length > 0 ? pedidosRates(pedidosDaLoja, 'categoria', lojaNomeLookup).slice(0, 5) : [];

    const skuDaLoja = dataset.pedidosDetalhamentoSku?.filter(r => r.pdvCodigo === codigo) ?? [];
    const sellInResumo = skuDaLoja.length > 0
      ? {
          sugestao: skuDaLoja.reduce((s, r) => s + r.sugestaoComercial, 0),
          realizado: skuDaLoja.reduce((s, r) => s + r.pedidoRealizado, 0),
          skusAbaixoMeta: sellInSkuRanking(skuDaLoja).filter(s => s.atingimentoMetaPct < 100).length,
        }
      : null;

    const fidelidade = dataset.fidelidade?.pdv.find(r => r.nome === codigo) ?? null;
    const servicos = dataset.servicos?.pdv.find(r => r.pdvCodigo === codigo) ?? null;
    const lojaDigital = dataset.lojaDigital?.pdv.find(r => r.pdvCodigo === codigo) ?? null;
    const cuidados = dataset.cuidadosFaciais?.pdv.find(r => r.pdvCodigo === codigo) ?? null;

    const logistica = dataset.logisticaAdesaoDetalhe
      ? logisticaAdesaoResumoPorPdv(dataset.logisticaAdesaoDetalhe).find(p => p.pdvCodigo === codigo) ?? null
      : null;

    const resumoRow = dataset.resumoPerformance?.pdv.find(r => r.nome === codigo) ?? null;
    const receitaCanalRow = dataset.receitaCanalLojaPdv?.find(r => r.pdvCodigo === codigo) ?? null;

    return {
      nome, lojaRow, canais, formas, categorias, topProdutos, pedidosPorCategoria, sellInResumo,
      fidelidade, servicos, lojaDigital, cuidados, logistica, resumoRow, receitaCanalRow,
    };
  }, [dataset, codigo]);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver o perfil da loja.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!perfil || !perfil.lojaRow) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15 }}>Nenhuma loja encontrada no dataset importado.</p>
      </div>
    );
  }

  const { nome, lojaRow, canais, formas, categorias, topProdutos, pedidosPorCategoria, sellInResumo, fidelidade, servicos, lojaDigital, cuidados, logistica, resumoRow, receitaCanalRow } = perfil;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Perfil da loja"
          hint="Tudo sobre uma loja em um só lugar — GMV, canais, formas de pagamento, produtos, pedidos, Fidelidade, serviços e logística — em vez de aplicar o filtro 'por loja' em cada tela separadamente."
        />
        <select
          value={codigo}
          onChange={e => setCodigoSel(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--loja-border, #E8E2D6)', background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)', cursor: 'pointer', fontWeight: 600 }}
        >
          {ranking.map(r => (
            <option key={r.lojaCodigos[0]} value={r.lojaCodigos[0]}>{r.key}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 8 }} />
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Fraunces, serif', marginBottom: 24 }}>{nome}</div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>GMV</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtBRLshort(lojaRow.gmv)}</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receita líquida</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtBRLshort(lojaRow.receitaLiquida)}</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Boletos</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtNumber(lojaRow.qtdBoletos)}</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Penetração Fidelidade</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{lojaRow.fidelidadePenetracao.toFixed(1).replace('.', ',')}%</div>
        </div>
        <div style={{
          background: resumoRow?.vsMetaPEFPct != null ? (resumoRow.vsMetaPEFPct >= 0 ? 'var(--loja-success-bg, #E0F2E8)' : 'var(--loja-danger-bg, #FBE5E9)') : 'var(--loja-surface, #FFFFFF)',
          border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
            Vs. Meta PEF
            <InfoHint text="Receita realizada vs. a meta PEF definida para essa loja no ciclo (Resumo de Performance)." />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: resumoRow?.vsMetaPEFPct != null ? (resumoRow.vsMetaPEFPct >= 0 ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-danger, #B83A3A)') : undefined }}>
            {resumoRow?.vsMetaPEFPct != null ? fmtPct(resumoRow.vsMetaPEFPct) : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard glow title="Mix de canais de venda" subtitle="Top 5 · canal de ativação">
          <MiniList items={canais.map(c => ({ label: c.key, value: fmtBRLshort(c.gmv), sub: `${c.participacaoPct.toFixed(0)}%` }))} />
        </ChartCard>
        <ChartCard glow title="Mix de formas de pagamento" subtitle="Top 5">
          <MiniList items={formas.map(f => ({ label: f.key, value: fmtBRLshort(f.gmv), sub: `${f.participacaoPct.toFixed(0)}%` }))} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard glow title="Top produtos (Curva ABC)" subtitle={topProdutos.length > 0 ? 'Top 6 por faturamento' : 'Arquivo não aberto por loja'}>
          <MiniList items={topProdutos.map(p => ({ label: p.descricao, value: fmtBRLshort(p.faturamento), sub: `Classe ${p.classe}` }))} />
        </ChartCard>
        <ChartCard glow title="Mix de categoria" subtitle="Top 6 · gestão estratégica">
          <MiniList items={categorias.map(c => ({ label: c.key, value: fmtBRLshort(c.gmv), sub: `${c.participacaoPct.toFixed(0)}%` }))} />
        </ChartCard>
      </div>

      {(pedidosPorCategoria.length > 0 || sellInResumo) && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Gestão de pedidos desta loja"
            hint="Taxa de colocação (Colocado/Sugestão) e atendimento (Faturado/Colocado) por categoria, e o resumo de sell-in por SKU quando disponível."
            subtitle="Reposição de estoque"
          >
            <div style={{ display: 'grid', gridTemplateColumns: sellInResumo ? '1fr 1fr' : '1fr', gap: 20 }}>
              <MiniList items={pedidosPorCategoria.map(p => ({ label: p.key, value: `${p.taxaAtendimentoPct.toFixed(0)}%`, sub: `coloc. ${p.taxaColocacaoPct.toFixed(0)}%` }))} />
              {sellInResumo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <StatRow label="Sugestão comercial (sell-in)" value={fmtNumber(sellInResumo.sugestao)} />
                  <StatRow label="Pedido realizado" value={fmtNumber(sellInResumo.realizado)} meta={`${sellInResumo.sugestao > 0 ? ((sellInResumo.realizado / sellInResumo.sugestao) * 100).toFixed(0) : 0}% da sugestão`} />
                  <StatRow label="SKUs abaixo da meta" value={fmtNumber(sellInResumo.skusAbaixoMeta)} />
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      )}

      {(fidelidade || servicos || lojaDigital || cuidados) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 20 }}>
          {fidelidade && (
            <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Desafio Fidelidade</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fidelidade.penetracaoPct.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)' }}>{fmtNumber(fidelidade.qtdBoletosDesafio)}/{fmtNumber(fidelidade.qtdBoletosFidelidade)} boletos</div>
            </div>
          )}
          {servicos && (
            <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Serviços em loja</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtBRLshort(servicos.gmv)}</div>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)' }}>{fmtNumber(servicos.qtdCompletos)} completos</div>
            </div>
          )}
          {lojaDigital && (
            <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loja Digital</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{lojaDigital.conversaoPct.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)' }}>{lojaDigital.clientesConvertidos}/{lojaDigital.clientesAtendidos} convertidos</div>
            </div>
          )}
          {cuidados && (
            <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cuidados Faciais + Botik</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtBRLshort(cuidados.receitaTotal)}</div>
              <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)' }}>Botik: {fmtBRLshort(cuidados.receitaBotik)}</div>
            </div>
          )}
        </div>
      )}

      {(logistica || receitaCanalRow) && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Logística e canal de cumprimento"
            hint="'Realizado vs. Meta PEF (canal Loja)' usa só o bloco Loja física de ReceitaCanalLoja_Performance_por_PDV.xlsx (base GMV), que bate com o GMV desta loja mostrado no topo da página — não inclui Clique e Retire."
            subtitle="Transferência entre lojas e Loja x Clique e Retire"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logistica && (
                <StatRow label="Adesão à plataforma logística" value={`${logistica.usaBemPct.toFixed(0)}% "Usa Bem"`} meta={`${logistica.total} pedido(s) · ${logistica.dentroDoPrazoPct.toFixed(0)}% no prazo`} />
              )}
              {receitaCanalRow && (
                <StatRow label="Realizado vs. Meta PEF (canal Loja)" value={receitaCanalRow.loja.realizadoPct != null ? `${receitaCanalRow.loja.realizadoPct.toFixed(0)}%` : '—'} meta={fmtBRL(receitaCanalRow.loja.receitaAtual)} />
              )}
            </div>
          </ChartCard>
        </div>
      )}

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <Button variant="ghost" size="md" onClick={() => onNavigate('loja-scorecard')}>Ver todos os indicadores PEF desta loja →</Button>
      </div>
    </div>
  );
};

export default LojaPerfilScreen;
