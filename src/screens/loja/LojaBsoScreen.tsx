import React, { useMemo, useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import Button from '../../components/ui/Button';
import KpiCard from '../../components/ui/KpiCard';
import PageTitle from '../../components/ui/PageTitle';
import SimpleLineChart from '../../components/loja/SimpleLineChart';
import { ColunaTabela, LojaTabela, LojaVazio, SeletorLoja } from '../../components/loja/lojaUi';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { exportToCSV } from '../../services/exportService';
import { fmtBRL, fmtBRLshort, fmtNumber } from '../../utils/formatters';
import { BsoRow } from '../../types/lojaExtranet';

interface Agrupado {
  chave: string;
  gerado: number;
  volume: number;
  linhas: number;
}

function agrupar(linhas: BsoRow[], chave: (l: BsoRow) => string): Agrupado[] {
  const mapa = new Map<string, Agrupado>();
  for (const l of linhas) {
    const k = chave(l);
    const a = mapa.get(k) ?? { chave: k, gerado: 0, volume: 0, linhas: 0 };
    a.gerado += l.gerado;
    a.volume += l.volume;
    a.linhas += 1;
    mapa.set(k, a);
  }
  return [...mapa.values()].sort((a, b) => b.gerado - a.gerado);
}

const colunasCampanha: ColunaTabela<Agrupado>[] = [
  { id: 'campanha', titulo: 'Campanha', valor: r => <strong>{r.chave}</strong>, ordem: r => r.chave },
  { id: 'gerado', titulo: 'Valor gerado', direita: true, valor: r => fmtBRL(r.gerado), ordem: r => r.gerado },
  { id: 'volume', titulo: 'Itens', direita: true, valor: r => fmtNumber(r.volume), ordem: r => r.volume },
  { id: 'linhas', titulo: 'Movimentações', direita: true, valor: r => fmtNumber(r.linhas), ordem: r => r.linhas },
];

const LIMITE_TABELA = 30;

const LojaBsoScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const bso = useLojaStore(s => s.dataset?.bso);
  const [loja, setLoja] = useState('');

  const linhas = useMemo(() => (bso?.linhas ?? []).filter(l => !loja || l.pdv === loja), [bso, loja]);
  const campanhas = useMemo(() => agrupar(linhas, l => l.campanha), [linhas]);
  const dias = useMemo(() => agrupar(linhas, l => l.data).sort((a, b) => a.chave.localeCompare(b.chave)), [linhas]);
  const porLoja = useMemo(() => agrupar(bso?.linhas ?? [], l => l.pdv), [bso]);
  const skus = useMemo(() => agrupar(linhas, l => l.sku), [linhas]);

  if (!bso || bso.linhas.length === 0) {
    return <LojaVazio onNavigate={onNavigate} mensagem={<>O arquivo <strong>RelatorioBso-GeradoDetalhePorPeriodo</strong> não foi importado.</>} />;
  }

  const total = linhas.reduce((s, l) => s + l.gerado, 0);
  const volume = linhas.reduce((s, l) => s + l.volume, 0);
  const lider = campanhas[0];
  const lojas = porLoja.map(l => ({ codigo: l.chave, nome: resolveLojaNome(l.chave, l.chave) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Campanhas BSO"
          hint="Valor gerado por campanha no ciclo, segundo o Relatório BSO da Extranet, com a abertura por loja, dia e produto."
        />
        <SeletorLoja lojas={lojas} valor={loja} onChange={setLoja} />
      </div>
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
        <KpiCard glow eyebrow="Valor gerado" value={fmtBRL(total)} meta={loja ? 'nesta loja' : 'rede toda'}
          hint="Soma da coluna GERADO de RelatorioBso-GeradoDetalhePorPeriodo.xlsx, só com os dias do ciclo. A aba GeradoPorCiclo pode dar um pouco mais quando o filtro da Extranet passa do último dia." />
        <KpiCard glow eyebrow="Campanhas" value={fmtNumber(campanhas.length)} meta="com valor no período" hint="Nomes de campanha distintos no arquivo." />
        <KpiCard glow eyebrow="Itens" value={fmtNumber(volume)} meta="soma da coluna VOLUME" hint="Itens nas movimentações do relatório." />
        {lider && <KpiCard glow eyebrow="Maior campanha" value={fmtBRLshort(lider.gerado)} meta={lider.chave.length > 46 ? `${lider.chave.slice(0, 46)}…` : lider.chave} hint={lider.chave} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <ChartCard glow title="Valor gerado por campanha" subtitle="Maiores campanhas do período"
          hint="Algumas campanhas vêm no arquivo só com o código (A-26027-018), sem nome.">
          <RankingChart
            medals={false}
            items={campanhas.slice(0, 15).map(c => ({
              label: c.chave.length > 60 ? `${c.chave.slice(0, 60)}…` : c.chave,
              value: c.gerado,
              valueLabel: fmtBRLshort(c.gerado),
              meta: `${fmtNumber(c.volume)} itens`,
            }))}
          />
        </ChartCard>
        {!loja && (
          <ChartCard glow title="Valor gerado por loja" subtitle="Rede toda" hint="Soma da coluna GERADO por PDV.">
            <RankingChart
              medals={false}
              items={porLoja.map(l => ({
                label: resolveLojaNome(l.chave, l.chave),
                value: l.gerado,
                valueLabel: fmtBRLshort(l.gerado),
                meta: `${fmtNumber(l.volume)} itens`,
              }))}
            />
          </ChartCard>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard glow title="Valor gerado por dia" subtitle="Data da movimentação" hint="Soma da coluna GERADO por DATA MOVIMENTAÇÃO.">
          <SimpleLineChart points={dias.map(d => ({ label: `${d.chave.slice(8, 10)}/${d.chave.slice(5, 7)}`, value: d.gerado }))} formatValue={fmtBRLshort} />
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginTop: 20 }}>
        <ChartCard glow title="Campanhas" subtitle={`${Math.min(LIMITE_TABELA, campanhas.length)} de ${fmtNumber(campanhas.length)} · exporte para ver todas`}
          action={<Button variant="ghost" size="sm" onClick={() => exportToCSV(campanhas.map(c => ({ Campanha: c.chave, 'Valor gerado': c.gerado, Itens: c.volume, Movimentacoes: c.linhas })), 'campanhas-bso')}>Exportar CSV</Button>}
        >
          <LojaTabela colunas={colunasCampanha} linhas={campanhas.slice(0, LIMITE_TABELA)} chave={r => r.chave} ordemInicial={{ id: 'gerado', desc: true }} />
        </ChartCard>
        <ChartCard glow title="Produtos com mais valor gerado" subtitle={`${Math.min(LIMITE_TABELA, skus.length)} de ${fmtNumber(skus.length)} SKUs`}
          hint="O arquivo traz só o código do SKU, sem a descrição do produto.">
          <LojaTabela
            colunas={[{ ...colunasCampanha[0], id: 'sku', titulo: 'SKU' }, ...colunasCampanha.slice(1)]}
            linhas={skus.slice(0, LIMITE_TABELA)}
            chave={r => r.chave}
            ordemInicial={{ id: 'gerado', desc: true }}
          />
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaBsoScreen;
