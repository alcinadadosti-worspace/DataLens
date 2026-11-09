import React, { useMemo, useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import KpiCard from '../../components/ui/KpiCard';
import PageTitle from '../../components/ui/PageTitle';
import { ColunaTabela, Leitura, LojaTabela, LojaVazio, SeletorLoja, pct } from '../../components/loja/lojaUi';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { fmtNumber } from '../../utils/formatters';
import { RupturaItemRow } from '../../types/vdCorporate';

const colunas: ColunaTabela<RupturaItemRow>[] = [
  { id: 'sku', titulo: 'Produto', valor: r => <strong>{r.sku}</strong>, ordem: r => r.sku },
  { id: 'loja', titulo: 'Loja', valor: r => resolveLojaNome(r.pdvCodigo, r.pdvCodigo), ordem: r => resolveLojaNome(r.pdvCodigo, r.pdvCodigo) },
  { id: 'causa', titulo: 'Causa', valor: r => (r.causaRuptura === '-' ? 'Não informada' : r.causaRuptura), ordem: r => r.causaRuptura },
  { id: 'volume', titulo: 'Volume', direita: true, valor: r => fmtNumber(r.volumeItens), ordem: r => r.volumeItens },
  { id: 'ruptura', titulo: '% ruptura', direita: true, valor: r => pct(r.rupturaPct), ordem: r => r.rupturaPct },
];

const LojaRupturaScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const ruptura = useLojaStore(s => s.dataset?.ruptura);
  const [loja, setLoja] = useState('');

  const porLoja = useMemo(() => {
    const mapa = new Map<string, { monitorados: number; emRuptura: number }>();
    for (const i of ruptura?.itens ?? []) {
      const atual = mapa.get(i.pdvCodigo) ?? { monitorados: 0, emRuptura: 0 };
      atual.monitorados += 1;
      if (i.rupturaPct > 0) atual.emRuptura += 1;
      mapa.set(i.pdvCodigo, atual);
    }
    return [...mapa.entries()].map(([codigo, v]) => ({ codigo, ...v, pct: (v.emRuptura / v.monitorados) * 100 })).sort((a, b) => b.pct - a.pct);
  }, [ruptura]);

  if (!ruptura) {
    return <LojaVazio onNavigate={onNavigate} mensagem={<>Os arquivos <strong>RupturaVD</strong> do canal Loja não foram importados.</>} />;
  }

  const { resumo, itens } = ruptura;
  const emRuptura = itens.filter(i => i.rupturaPct > 0 && (!loja || i.pdvCodigo === loja));
  const lojas = porLoja.map(l => ({ codigo: l.codigo, nome: resolveLojaNome(l.codigo, l.codigo) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pior = porLoja[0];
  // O arquivo por item só abre a causa franqueado; a causa indústria aparece apenas no total do ciclo.
  const soCausaFranqueado = emRuptura.length > 0 && emRuptura.every(i => /franqueado/i.test(i.causaRuptura));

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Ruptura"
          hint="Produtos monitorados que faltaram nas lojas durante o ciclo, separando o que depende da franquia do que veio da indústria."
        />
        <SeletorLoja lojas={lojas} valor={loja} onChange={setLoja} />
      </div>
      <div style={{ marginBottom: 24 }} />

      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
          <KpiCard glow eyebrow="Ruptura total" value={pct(resumo.rupturaTotalPct, 2)} meta="no ciclo" hint="RupturaVD_Ruptura_detalhada_ciclo.xlsx, filtrado para o canal Loja." />
          <KpiCard glow eyebrow="Causa franqueado" value={pct(resumo.rupturaCausaFranqueadoPct, 2)} meta="indicador do IAF" hint="Parte da ruptura atribuída à franquia, a que entra no IAF." />
          <KpiCard glow eyebrow="Causa indústria" value={pct(resumo.rupturaCausaIndustriaPct, 2)} meta="no ciclo" hint="Parte da ruptura atribuída à indústria." />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        <ChartCard glow title="Itens em ruptura por loja" subtitle="% dos SKUs monitorados com ruptura no ciclo"
          hint="RupturaVD_detalhamento_ruptura_por_item.xlsx. O arquivo lista só os SKUs monitorados, não o catálogo inteiro, então este número não é a ruptura total da loja.">
          <RankingChart
            medals={false}
            items={porLoja.map(l => ({
              label: resolveLojaNome(l.codigo, l.codigo),
              value: l.pct,
              valueLabel: pct(l.pct),
              meta: `${fmtNumber(l.emRuptura)} de ${fmtNumber(l.monitorados)} SKUs`,
            }))}
          />
        </ChartCard>
        <ChartCard glow title="Leitura" subtitle="O que olhar primeiro" hint="Interpretação automática dos números acima.">
          <Leitura>
            {resumo?.rupturaTotalPct != null && resumo.rupturaCausaIndustriaPct != null && resumo.rupturaCausaFranqueadoPct != null && (
              <>Da ruptura de <strong>{pct(resumo.rupturaTotalPct, 2)}</strong>, a causa indústria responde por {pct(resumo.rupturaCausaIndustriaPct, 2)} e a causa franqueado por {pct(resumo.rupturaCausaFranqueadoPct, 2)}. </>
            )}
            {pior && <><strong>{resolveLojaNome(pior.codigo, pior.codigo)}</strong> tem a maior parcela de itens monitorados em ruptura: {fmtNumber(pior.emRuptura)} de {fmtNumber(pior.monitorados)}. </>}
            {soCausaFranqueado && <>A lista abaixo traz só a causa franqueado: o arquivo por item não detalha os produtos da causa indústria.</>}
          </Leitura>
        </ChartCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard glow title="Produtos em ruptura" subtitle={`${fmtNumber(emRuptura.length)} itens · clique na coluna para ordenar`}
          hint="RupturaVD_detalhamento_ruptura_por_item.xlsx, só as linhas com ruptura acima de zero. 'Não informada' é quando o arquivo traz '-' na causa.">
          <LojaTabela colunas={colunas} linhas={emRuptura} chave={(r, i) => `${r.pdvCodigo}-${r.sku}-${i}`} ordemInicial={{ id: 'ruptura', desc: true }} vazio="Nenhum item em ruptura nesta loja." />
        </ChartCard>
      </div>
    </div>
  );
};

export default LojaRupturaScreen;
