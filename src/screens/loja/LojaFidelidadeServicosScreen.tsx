import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import { RankingItem } from '../../components/loja/RankingList';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { fmtBRL, fmtPct, fmtNumber } from '../../utils/formatters';
import { ServicoConsultorRow } from '../../types/loja';

function aggregateServicoTipo(rows: ServicoConsultorRow[]) {
  const map = new Map<string, { qtd: number; completos: number; gmv: number }>();
  for (const r of rows) {
    const cur = map.get(r.servico) ?? { qtd: 0, completos: 0, gmv: 0 };
    cur.qtd += r.qtdRealizados;
    cur.completos += r.qtdCompletos;
    cur.gmv += r.gmv;
    map.set(r.servico, cur);
  }
  return Array.from(map.entries())
    .map(([servico, v]) => ({ servico, ...v }))
    .sort((a, b) => b.gmv - a.gmv);
}

const LojaFidelidadeServicosScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [tab, setTab] = useState<'lojas' | 'consultores'>('lojas');

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver fidelidade e serviços em loja.</p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const fidelidade = dataset.fidelidade;
  const servicos = dataset.servicos;
  const lojaDigital = dataset.lojaDigital;
  const cuidadosFaciais = dataset.cuidadosFaciais;

  const hasAny = fidelidade || servicos || lojaDigital || cuidadosFaciais;

  if (!hasAny) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          Nenhum arquivo de Fidelidade, Serviços, Loja Digital ou Cuidados Faciais foi importado ainda.
        </p>
        <Button variant="primary" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  const fidelidadeItems: RankingItem[] = fidelidade
    ? [...(tab === 'lojas' ? fidelidade.pdv : fidelidade.consultor)]
        .sort((a, b) => b.penetracaoPct - a.penetracaoPct)
        .map(r => ({
          label: tab === 'lojas' ? resolveLojaNome(r.nome, r.nome) : r.nome,
          value: r.penetracaoPct,
          valueLabel: fmtPct(r.penetracaoPct).replace('+', ''),
          meta: `${fmtNumber(r.qtdBoletosDesafio)}/${fmtNumber(r.qtdBoletosFidelidade)} boletos`,
        }))
    : [];

  const servicosPdvItems: RankingItem[] = servicos
    ? [...servicos.pdv]
        .sort((a, b) => b.gmv - a.gmv)
        .map(r => ({
          label: resolveLojaNome(r.pdvCodigo, r.pdvCodigo),
          value: r.gmv,
          valueLabel: fmtBRL(r.gmv),
          meta: `${r.qtdCompletos}/${r.qtdRealizados} completos${r.qtdMeta > 0 ? ` · ${fmtPct(r.atingimentoPct).replace('+', '')} da meta` : ''}`,
        }))
    : [];

  const servicoTipos = servicos ? aggregateServicoTipo(servicos.consultor) : [];
  const servicoTiposItems: RankingItem[] = servicoTipos.map(s => ({
    label: s.servico,
    value: s.gmv,
    valueLabel: fmtBRL(s.gmv),
    meta: `${s.completos}/${s.qtd} completos`,
  }));

  const digitalItems: RankingItem[] = lojaDigital
    ? [...lojaDigital.pdv]
        .sort((a, b) => b.conversaoPct - a.conversaoPct)
        .map(r => ({
          label: resolveLojaNome(r.pdvCodigo ?? r.nome, r.nome),
          value: r.conversaoPct,
          valueLabel: fmtPct(r.conversaoPct).replace('+', ''),
          meta: `${r.clientesConvertidos}/${r.clientesAtendidos} atendidos · ${fmtBRL(r.receita)}`,
        }))
    : [];

  const cuidadosItems: RankingItem[] = cuidadosFaciais
    ? [...cuidadosFaciais.pdv]
        .sort((a, b) => b.receitaTotal - a.receitaTotal)
        .map(r => ({
          label: resolveLojaNome(r.pdvCodigo ?? r.nome, r.nome),
          value: r.receitaTotal,
          valueLabel: fmtBRL(r.receitaTotal),
          meta: `Botik: ${fmtBRL(r.receitaBotik)}`,
        }))
    : [];

  const totalDesafio = fidelidade?.cp[0]?.qtdBoletosDesafio ?? null;
  const totalBoletosFid = fidelidade?.cp[0]?.qtdBoletosFidelidade ?? null;
  const penetracaoRede = fidelidade?.cp[0]?.penetracaoPct ?? null;

  const totalServicosGmv = servicos ? servicos.pdv.reduce((s, r) => s + r.gmv, 0) : 0;
  const totalServicosCompletos = servicos ? servicos.pdv.reduce((s, r) => s + r.qtdCompletos, 0) : 0;

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Fidelidade, serviços & digital"
          hint="Reúne os 4 arquivos xlsx mais novos: Programa Fidelidade, Serviços em loja, Loja Digital e Cuidados Faciais + Botik — cada um com visão de rede completa, por loja ou por consultor."
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['lojas', 'consultores'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 13, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${tab === t ? '#1C1814' : '#E8E2D6'}`,
                background: tab === t ? '#1C1814' : 'white',
                color: tab === t ? 'white' : '#1C1814', fontWeight: 600,
              }}
            >
              {t === 'lojas' ? 'Por loja' : 'Por consultor'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 24 }} />

      {penetracaoRede !== null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          <ChartCard
            title="Penetração Fidelidade — rede"
            hint="Dos boletos de cliente Fidelidade, % que concluiu o 'desafio' do programa — uma ação/meta específica, diferente de simplesmente ser cliente cadastrado."
          >
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtPct(penetracaoRede).replace('+', '')}</div>
            <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>
              {fmtNumber(totalDesafio ?? 0)} de {fmtNumber(totalBoletosFid ?? 0)} boletos com desafio concluído
            </div>
          </ChartCard>
          {servicos && (
            <ChartCard
              title="Serviços em loja — GMV total"
              hint="GMV — Gross Merchandise Value: valor total vendido a partir de serviços de beleza (maquiagem, cuidados faciais, cabelo...) prestados em loja."
            >
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtBRL(totalServicosGmv)}</div>
              <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>{fmtNumber(totalServicosCompletos)} serviços completos</div>
            </ChartCard>
          )}
          {cuidadosFaciais && cuidadosFaciais.participacaoPct !== null && (
            <ChartCard
              title="Cuidados Faciais + Botik — % da receita"
              hint="GMV — Gross Merchandise Value. % do GMV da rede que veio da linha de produtos Botik e da categoria Cuidados Faciais."
            >
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtPct(cuidadosFaciais.participacaoPct).replace('+', '')}</div>
              <div style={{ fontSize: 12, color: '#6B6258', marginTop: 4 }}>do GMV total da rede no ciclo</div>
            </ChartCard>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {fidelidade && (
          <ChartCard
            title={`Penetração Fidelidade — ${tab === 'lojas' ? 'por loja' : 'por consultor'}`}
            hint="% de boletos de cliente Fidelidade que concluíram o 'desafio' do programa (ação/meta específica), loja a loja ou consultor a consultor."
            subtitle="% de boletos com desafio Fidelidade concluído"
          >
            <RankingChart items={fidelidadeItems} />
          </ChartCard>
        )}

        {digitalItems.length > 0 && (
          <ChartCard
            title="Loja Digital — conversão por loja"
            hint="% de clientes atendidos via WhatsApp/canais digitais que converteram em venda, por loja."
            subtitle="% de clientes atendidos que converteram em venda"
          >
            <RankingChart items={digitalItems} />
          </ChartCard>
        )}

        {servicosPdvItems.length > 0 && (
          <ChartCard
            title="Serviços em loja — GMV por loja"
            hint="GMV — Gross Merchandise Value gerado por serviços de beleza (maquiagem, cuidados faciais, cabelo...) em cada loja."
            subtitle="Maquiagem, cuidados faciais, cabelo etc."
          >
            <RankingChart items={servicosPdvItems} />
          </ChartCard>
        )}

        {servicoTiposItems.length > 0 && (
          <ChartCard
            title="Mix de serviços — rede"
            hint="GMV gerado por cada tipo de serviço de beleza, somado em toda a rede."
            subtitle="GMV gerado por tipo de serviço"
          >
            <RankingChart items={servicoTiposItems} />
          </ChartCard>
        )}

        {cuidadosItems.length > 0 && (
          <ChartCard
            title="Cuidados Faciais + Botik — receita por loja"
            hint="Receita gerada pelo recorte de produtos Botik/Cuidados Faciais, loja a loja."
            subtitle="Receita total do bloco Botik dentro da loja"
          >
            <RankingChart items={cuidadosItems} />
          </ChartCard>
        )}
      </div>

      {fidelidade && servicos && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Leitura cruzada"
            hint="Insight conectando a penetração do programa Fidelidade com o desempenho de serviços em loja."
            subtitle="Fidelidade vs. serviços em loja"
          >
            <div style={{ display: 'flex', gap: 8, fontSize: 13, color: '#3D362E', lineHeight: 1.6, marginTop: 12 }}>
              <i className="ph ph-lightbulb" style={{ color: '#C9A227', fontSize: 16, flexShrink: 0, marginTop: 1 }} />
              <span>
                Lojas com penetração de Fidelidade alta tendem a ter clientes mais recorrentes — vale cruzar com o
                ranking de serviços em loja: quem oferece mais serviços (maquiagem, cuidados faciais) costuma reter
                melhor o cliente no clube. Se uma loja aparece bem no ranking de serviços mas mal na penetração de
                Fidelidade, é sinal de que o consultor não está oferecendo o desafio no ato do atendimento.
              </span>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaFidelidadeServicosScreen;
