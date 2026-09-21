import React, { useMemo } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { useLojaStore } from '../../store/useLojaStore';
import { logisticaAdesaoResumoPorPdv, logisticaRotas, logisticaPedidosEmAberto } from '../../analytics/lojaMetrics';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { fmtNumber, fmtPct } from '../../utils/formatters';

const LojaLogisticaScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);

  const data = useMemo(() => {
    if (!dataset?.logisticaAdesaoDetalhe) return null;
    const detalhe = dataset.logisticaAdesaoDetalhe;
    const porPdv = logisticaAdesaoResumoPorPdv(detalhe);
    const rotas = logisticaRotas(detalhe).slice(0, 12);
    const emAberto = logisticaPedidosEmAberto(detalhe).slice(0, 15);
    const total = detalhe.length;
    const usaBem = detalhe.filter(r => r.categoriaAdesao.trim().toLowerCase() === 'usa bem').length;
    const dentroDoPrazo = detalhe.filter(r => r.statusPrazo.trim().toLowerCase() === 'dentro do prazo').length;
    const slaValues = detalhe.map(r => r.qtdDiasUteisEntrega).filter((v): v is number => v != null);
    const slaMedio = slaValues.length > 0 ? slaValues.reduce((s, v) => s + v, 0) / slaValues.length : null;
    return { porPdv, rotas, emAberto, total, usaBemPct: total > 0 ? (usaBem / total) * 100 : 0, dentroDoPrazoPct: total > 0 ? (dentroDoPrazo / total) * 100 : 0, slaMedio };
  }, [dataset]);

  const resumo = dataset?.logisticaAdesaoResumo ?? [];

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver a logística.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          O arquivo <strong>GestaoPedidos_Visão_detalhada_da_utilização_por_pedido</strong> não foi importado — logística indisponível.
        </p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar arquivo</Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <PageTitle
        eyebrow="Modo Loja"
        title="Logística"
        hint="Adesão à plataforma logística de transferência de produtos entre lojas ('Colabore'): quanto cada loja usa bem a ferramenta, o SLA de entrega e os pedidos parados no momento da exportação."
      />
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pedidos de transferência</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtNumber(data.total)}</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
            "Usa Bem" a plataforma
            <InfoHint text="% de pedidos cuja categoria de adesão é 'Usa Bem' — a categoria de melhor uso da ferramenta de transferência entre lojas." />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.usaBemPct.toFixed(1).replace('.', ',')}%</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dentro do prazo</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.dentroDoPrazoPct.toFixed(1).replace('.', ',')}%</div>
        </div>
        <div style={{ background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SLA médio de entrega</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.slaMedio != null ? `${data.slaMedio.toFixed(1)}d úteis` : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <ChartCard glow
          title="Adesão por loja de destino"
          hint="% de pedidos com categoria 'Usa Bem' por PDV de destino, com % dentro do prazo e SLA médio de entrega em dias úteis."
          subtitle="Ranking por PDV"
        >
          <RankingChart
            medals={false}
            items={data.porPdv.map(p => ({
              label: resolveLojaNome(p.pdvCodigo, p.pdvCodigo),
              value: p.usaBemPct,
              valueLabel: `${p.usaBemPct.toFixed(0)}%`,
              meta: `${p.dentroDoPrazoPct.toFixed(0)}% no prazo · ${p.total} pedido(s)${p.slaMedioDiasUteis != null ? ` · SLA ${p.slaMedioDiasUteis.toFixed(1)}d` : ''}`,
            }))}
          />
        </ChartCard>

        <ChartCard glow title="Categorias de adesão (rede)" subtitle="Resumo do CP inteiro">
          {resumo.length === 0 ? (
            <div style={{ color: 'var(--loja-text-muted, #9B9287)', fontSize: 13 }}>Arquivo de resumo não importado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resumo.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--loja-bg-subtle, #F2EEE2)', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.categoria}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)' }}>
                    {fmtNumber(r.qtdPedidos)} · {fmtPct(r.percentualPedidosPct).replace('+', '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard glow
          title="Rotas mais frequentes"
          hint="Pares cidade/UF de origem → destino com mais pedidos de transferência no ciclo, com o SLA médio de entrega e % 'Usa Bem' de cada rota."
          subtitle={`${data.rotas.length} rota(s) — top por volume`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--loja-text-muted, #9B9287)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Origem</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Destino</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Pedidos</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>SLA médio</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Usa Bem</th>
                </tr>
              </thead>
              <tbody>
                {data.rotas.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
                    <td style={{ padding: '8px 10px' }}>{r.origem}</td>
                    <td style={{ padding: '8px 10px' }}>{r.destino}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNumber(r.qtdPedidos)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{r.slaMedioDiasUteis != null ? `${r.slaMedioDiasUteis.toFixed(1)}d` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{r.usaBemPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {data.emAberto.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Pedidos em aberto"
            hint="Pedidos de transferência que ainda não foram finalizados no momento da exportação, ordenados do mais parado (mais dias úteis em aberto) para o mais recente."
            subtitle={`${data.emAberto.length} pedido(s) em aberto (mostrando os mais antigos)`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--loja-text-muted, #9B9287)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Pedido</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Destino</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Rota</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Dias em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.emAberto.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--loja-bg-subtle, #F2EEE2)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'JetBrains Mono, monospace' }}>{r.codigoPedido}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600 }}>{resolveLojaNome(r.pdvCodigo, r.pdvCodigo)}</td>
                      <td style={{ padding: '7px 10px', color: 'var(--loja-text-secondary, #6B6258)' }}>{r.cidadeOrigem}/{r.ufOrigem} → {r.cidadeDestino}/{r.ufDestino}</td>
                      <td style={{ padding: '7px 10px' }}>{r.statusPedido}</td>
                      <td style={{
                        padding: '7px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                        color: (r.qtdDiasUteisEmAberto ?? 0) > 5 ? 'var(--loja-danger, #B83A3A)' : 'var(--loja-text-strong, #3D362E)',
                      }}>
                        {r.qtdDiasUteisEmAberto}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaLogisticaScreen;
