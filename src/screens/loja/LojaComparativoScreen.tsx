import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import PageTitle from '../../components/ui/PageTitle';
import { Alternador, CelulaVariacao, ColunaTabela, LojaTabela, LojaVazio, pct, variacao } from '../../components/loja/lojaUi';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { chaveMetrica } from '../../parsers/lojaExtranetParser';
import { fmtBRL, fmtNumber } from '../../utils/formatters';
import { BenchmarkIndicador, PdvMetricasRow } from '../../types/lojaExtranet';

type Grupo = 'foraDoClube' | 'dentroDoClube';
type Formato = 'brl' | 'numero' | 'decimal' | 'pct';

const METRICAS: { id: string; label: string; formato: Formato }[] = [
  { id: chaveMetrica('RECEITA (R$)'), label: 'Receita GMV', formato: 'brl' },
  { id: chaveMetrica('QUANTIDADE DE BOLETOS'), label: 'Boletos', formato: 'numero' },
  { id: chaveMetrica('BOLETO MÉDIO'), label: 'Boleto médio', formato: 'brl' },
  { id: chaveMetrica('ITENS POR BOLETO'), label: 'Itens por boleto', formato: 'decimal' },
  { id: chaveMetrica('PREÇO MÉDIO'), label: 'Preço médio', formato: 'brl' },
  { id: chaveMetrica('RECEITA MOBSHOP (R$)'), label: 'Receita Mobshop', formato: 'brl' },
  { id: chaveMetrica('SHARE DE ALAVANCAS BT/BP'), label: 'Share de alavancas', formato: 'pct' },
];

function formatar(v: number | null, f: Formato): string {
  if (v == null) return '—';
  if (f === 'brl') return fmtBRL(v);
  if (f === 'numero') return fmtNumber(v);
  if (f === 'pct') return pct(v * 100, 2);
  return v.toFixed(2).replace('.', ',');
}

const ranking = (r: string) => Number.parseInt(r, 10) || null;

const LojaComparativoScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [grupo, setGrupo] = useState<Grupo>('foraDoClube');
  const [metrica, setMetrica] = useState(METRICAS[0].id);

  if (!dataset?.indicadoresLoja && !dataset?.idCliente) {
    return <LojaVazio onNavigate={onNavigate} mensagem={<>Os arquivos <strong>Loja_Indicadores_de_Loja</strong> e <strong>Indicadores_ID_Cliente</strong> não foram importados.</>} />;
  }

  const indicadores = [...(dataset.indicadoresLoja?.benchmark ?? []), ...(dataset.idCliente?.benchmark ?? [])];
  const pdvs = dataset.indicadoresLoja?.pdv ?? [];
  const m = METRICAS.find(x => x.id === metrica) ?? METRICAS[0];

  const colunasBenchmark: ColunaTabela<BenchmarkIndicador>[] = [
    { id: 'indicador', titulo: 'Indicador', valor: r => <strong>{r.indicador}</strong> },
    { id: 'resultado', titulo: 'Resultado', direita: true, valor: r => r.resultado },
    ...(['regional', 'estado', 'pais'] as const).flatMap((nivel): ColunaTabela<BenchmarkIndicador>[] => {
      const titulo = { regional: 'Regional', estado: 'Estado', pais: 'País' }[nivel];
      return [
        { id: `${nivel}-pos`, titulo: `${titulo}: posição`, direita: true, valor: r => r[grupo][nivel].ranking, ordem: r => ranking(r[grupo][nivel].ranking) },
        { id: `${nivel}-media`, titulo: `${titulo}: média`, direita: true, valor: r => r[grupo][nivel].media },
      ];
    }),
  ];

  const colunasPdv: ColunaTabela<PdvMetricasRow>[] = [
    { id: 'loja', titulo: 'Loja', valor: r => <strong>{resolveLojaNome(r.pdv, r.pdv)}</strong> },
    { id: 'anterior', titulo: 'Mesmo ciclo em 2025', direita: true, valor: r => (r.metricas[metrica]?.anterior ? formatar(r.metricas[metrica].anterior, m.formato) : '—'), ordem: r => r.metricas[metrica]?.anterior ?? null },
    { id: 'atual', titulo: 'Ciclo atual', direita: true, valor: r => formatar(r.metricas[metrica]?.atual ?? null, m.formato), ordem: r => r.metricas[metrica]?.atual ?? null },
    {
      id: 'variacao', titulo: 'Variação', direita: true,
      valor: r => <CelulaVariacao valor={variacao(r.metricas[metrica]?.anterior, r.metricas[metrica]?.atual)} />,
      ordem: r => variacao(r.metricas[metrica]?.anterior, r.metricas[metrica]?.atual),
    },
  ];

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Comparativo da rede"
          hint="Onde o CP está em relação às médias regional, estadual e nacional, e como cada loja evoluiu contra o mesmo ciclo do ano anterior."
        />
        <Alternador
          opcoes={[{ id: 'foraDoClube', label: 'Fora do clube' }, { id: 'dentroDoClube', label: 'Dentro do clube' }]}
          valor={grupo}
          onChange={setGrupo}
        />
      </div>
      <div style={{ marginBottom: 24 }} />

      <ChartCard glow
        title="Posição do CP por indicador"
        subtitle={`${grupo === 'foraDoClube' ? 'Fora do clube' : 'Dentro do clube'} · clique em uma posição para ordenar`}
        hint="Loja_Indicadores_de_Loja.xlsx e Indicadores_ID_Cliente.xlsx, aba CP. Posição e média vêm prontas do arquivo. Os grupos 'Fora do clube' e 'Dentro do clube' têm os nomes usados no relatório, que não explica quem entra em cada um. Atenção à posição dos indicadores em que menos é melhor, como uso indevido: o arquivo não diz se 1º é o menor ou o maior valor, então compare o resultado com a média."
      >
        <LojaTabela colunas={colunasBenchmark} linhas={indicadores} chave={r => r.indicador} />
      </ChartCard>

      {pdvs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow
            title="Loja a loja contra o ano anterior"
            subtitle="Mesmo ciclo de 2025 · uma medida por vez"
            hint="Loja_Indicadores_de_Loja.xlsx, aba PDV. A variação é recalculada aqui a partir dos dois ciclos. Loja sem movimento no ano anterior fica sem variação, em vez de mostrar 0%."
            action={(
              <select
                value={metrica}
                onChange={e => setMetrica(e.target.value)}
                style={{ fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--loja-border, #E8E2D6)', background: 'var(--loja-surface, #FFFFFF)', color: 'var(--loja-ink, #1C1814)' }}
              >
                {METRICAS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            )}
          >
            <LojaTabela colunas={colunasPdv} linhas={pdvs} chave={r => r.pdv} ordemInicial={{ id: 'atual', desc: true }} />
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaComparativoScreen;
