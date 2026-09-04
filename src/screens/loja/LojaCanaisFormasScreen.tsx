import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { aggregateByName, listLojasInDimension } from '../../analytics/lojaMetrics';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import PageTitle from '../../components/ui/PageTitle';
import { fmtBRLshort, fmtBRL, fmtPct } from '../../utils/formatters';

const LojaCanaisFormasScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [lojaFiltro, setLojaFiltro] = useState<string>('');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver canais e formas de pagamento.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const lojas = listLojasInDimension(dataset.canal);
  const canais = aggregateByName(dataset.canal, true, lojaFiltro || null);
  const formas = aggregateByName(dataset.forma, true, lojaFiltro || null);

  const toItems = (list: typeof canais) => list.map(r => ({
    label: r.key,
    value: r.gmv,
    valueLabel: fmtBRLshort(r.gmv),
    meta: `${r.participacaoPct.toFixed(1).replace('.', ',')}%`,
  }));

  const topCanal = canais[0];
  const topForma = formas[0];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Canais & formas de pagamento"
          hint="Como o GMV da rede se divide entre canais de venda (loja física, experimentação, calçada...) e formas de pagamento (cartão, PIX...)."
        />
        <select
          value={lojaFiltro}
          onChange={e => setLojaFiltro(e.target.value)}
          style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #E8E2D6', background: 'white', color: '#1C1814', cursor: 'pointer' }}
        >
          <option value="">Todas as lojas</option>
          {lojas.map(l => (
            <option key={l.codigo} value={l.codigo}>{l.codigo} - {l.nome}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard
          title="Mix de canais de venda"
          hint="GMV — Gross Merchandise Value: cada canal por onde a venda pode entrar (loja física, WhatsApp, experimentação, calçada...), com o % que representa do total."
          subtitle="Participação no GMV do grupo"
        >
          <RankingChart items={toItems(canais)} />
        </ChartCard>
        <ChartCard
          title="Mix de formas de pagamento"
          hint="Como o GMV recebido se divide entre as formas de pagamento usadas pelo cliente (cartão de crédito, débito, PIX, dinheiro...)."
          subtitle="Participação no GMV recebido"
        >
          <RankingChart items={toItems(formas)} />
        </ChartCard>
      </div>

      {dataset.receitaCanal && dataset.receitaCanal.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Receita por canal / UN — ciclo atual vs. anterior"
            hint="UN — Unidade de Negócio: agrupamento de canais/marcas usado pelo sistema de origem (Receita_por_Canal_UN.xlsx). Compara a receita do ciclo atual com a do ciclo anterior, canal a canal."
            subtitle={lojaFiltro ? 'Receita_por_Canal_UN.xlsx — sempre rede toda, esse arquivo não abre por loja' : 'Receita_por_Canal_UN.xlsx (GMV + Omni)'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dataset.receitaCanal.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F2EEE2', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{c.canal}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                    {fmtBRLshort(c.receitaAtual)} <span style={{ color: c.variacaoPct >= 0 ? '#2E7D5B' : '#B83A3A' }}>{fmtPct(c.variacaoPct)}</span>
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {dataset.lojaDigital && dataset.lojaDigital.pdv.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Loja Digital — funil de atendimento"
            hint="Funil de atendimento via WhatsApp/canais digitais: quantos clientes foram atendidos e quantos converteram em venda, por loja. Não é somado ao mix de canais acima — é outro recorte."
            subtitle="LojaDigital_Performance_por_Pdv_Consultor.xlsx — atendimento via WhatsApp/digital, não é um dos canais de venda acima (não somamos aos rankings de cima)"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...dataset.lojaDigital.pdv].sort((a, b) => b.receita - a.receita).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #F2EEE2', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{resolveLojaNome(r.pdvCodigo ?? r.nome, r.nome)}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6B6258' }}>
                    {r.clientesConvertidos}/{r.clientesAtendidos} convertidos ({fmtPct(r.conversaoPct).replace('+', '')}) · {fmtBRLshort(r.receita)}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {topCanal && topForma && (
        <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Leitura cruzada"
          hint="Cruza o canal de venda líder com a forma de pagamento mais usada, para apontar diferenças de perfil de cliente entre canais."
          subtitle="Canal vs. forma de pagamento"
        >
          <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.6, marginTop: 12 }}>
            <i className="ph ph-lightbulb" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
            <span>
              O canal <strong>{topCanal.key}</strong> ({fmtBRL(topCanal.gmv)}) concentra a maior parte do faturamento,
              recebido majoritariamente via <strong>{topForma.key}</strong> ({topForma.participacaoPct.toFixed(1).replace('.', ',')}% do total).
              Compare os dois rankings para identificar se canais de experimentação (make/skin, calçada) têm mix de pagamento
              diferente da loja física — indício de perfil de cliente distinto.
            </span>
          </div>
        </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaCanaisFormasScreen;
