import React, { useState } from 'react';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import KpiCard from '../../components/ui/KpiCard';
import PageTitle from '../../components/ui/PageTitle';
import { Alternador, CelulaVariacao, ColunaTabela, Leitura, LojaTabela, LojaVazio, pct, variacao } from '../../components/loja/lojaUi';
import { useLojaStore } from '../../store/useLojaStore';
import { resolveLojaNome } from '../../analytics/lojaStoreAliases';
import { fmtBRL, fmtNumber } from '../../utils/formatters';
import { BoletoResumoRow, ItensPorBoletoRow } from '../../types/lojaExtranet';

type Nivel = 'pdv' | 'consultor';

const FAIXAS_ITENS = ['1 item', '2 itens', '3 itens', '4 itens', '5 ou mais'];

const colunasResumo: ColunaTabela<BoletoResumoRow>[] = [
  { id: 'label', titulo: 'Faixa', valor: r => <strong>{r.label}</strong> },
  { id: 'anterior', titulo: 'Mesmo ciclo em 2025', direita: true, valor: r => fmtNumber(r.anterior) },
  { id: 'atual', titulo: 'Ciclo atual', direita: true, valor: r => fmtNumber(r.atual) },
  { id: 'variacao', titulo: 'Variação', direita: true, valor: r => <CelulaVariacao valor={variacao(r.anterior, r.atual)} /> },
];

const LojaBoletosScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const [nivel, setNivel] = useState<Nivel>('pdv');

  const resumo = dataset?.boletoResumo ?? [];
  const promocional = dataset?.boletoPromocional;
  const turbinado = dataset?.boletoTurbinado;
  const itens = dataset?.itensPorBoleto;
  const abastecimento = dataset?.abastecimento?.[0];

  if (!promocional && !turbinado && resumo.length === 0) {
    return <LojaVazio onNavigate={onNavigate} mensagem={<>Os arquivos <strong>Loja_Boleto</strong>, <strong>Loja_Boleto promocional</strong> e <strong>Loja_Boleto turbinado</strong> não foram importados.</>} />;
  }

  const nomeDe = (nome: string) => (nivel === 'pdv' ? resolveLojaNome(nome, nome) : nome);
  const achar = (rotulo: RegExp) => resumo.find(r => rotulo.test(r.label));
  const boletos = achar(/^quantidade de boletos$/i);
  const medio = achar(/^boleto m[eé]dio$/i);
  const itensBoleto = achar(/^itens por boleto$/i);
  const faixasValor = resumo.filter(r => /^(até|entre|acima)/i.test(r.label));
  const faixasItens = resumo.filter(r => /^boleto \d/i.test(r.label));
  const promoRede = promocional?.cp[0];
  const turboRede = turbinado?.cp[0];

  const colunasItens: ColunaTabela<ItensPorBoletoRow>[] = [
    { id: 'nome', titulo: nivel === 'pdv' ? 'Loja' : 'Consultor', valor: r => <strong>{nomeDe(r.nome)}</strong>, ordem: r => nomeDe(r.nome) },
    { id: 'total', titulo: 'Boletos', direita: true, valor: r => fmtNumber(r.total), ordem: r => r.total },
    ...FAIXAS_ITENS.map((titulo, i): ColunaTabela<ItensPorBoletoRow> => ({
      id: `f${i}`, titulo, direita: true,
      valor: r => pct(r.total > 0 ? (r.quantidades[i] / r.total) * 100 : null),
      ordem: r => (r.total > 0 ? r.quantidades[i] / r.total : null),
    })),
  ];

  const b1 = faixasItens[0];
  const totalItensAtual = faixasItens.reduce((s, r) => s + r.atual, 0);
  const totalItensAnterior = faixasItens.reduce((s, r) => s + r.anterior, 0);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Boletos & alavancas"
          hint="Do que é feito o boleto do ciclo: faixas de valor, quantidade de itens e as duas alavancas de venda, Boleto Promocional e Boleto Turbinado."
        />
        <Alternador opcoes={[{ id: 'pdv', label: 'Por loja' }, { id: 'consultor', label: 'Por consultor' }]} valor={nivel} onChange={setNivel} />
      </div>
      <div style={{ marginBottom: 24 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        {boletos && (
          <KpiCard glow eyebrow="Boletos" value={fmtNumber(boletos.atual)} meta={`${fmtNumber(boletos.anterior)} em 2025`}
            delta={`${Math.abs(variacao(boletos.anterior, boletos.atual) ?? 0).toFixed(1).replace('.', ',')}%`}
            deltaDirection={boletos.atual >= boletos.anterior ? 'up' : 'down'}
            hint="Quantidade de boletos do canal Loja no ciclo, na base da Extranet (Loja_Boleto.xlsx). Pode diferir um pouco do GerencialVendas, que vem do ERP." />
        )}
        {medio && (
          <KpiCard glow eyebrow="Boleto médio" value={fmtBRL(medio.atual)} meta={`${fmtBRL(medio.anterior)} em 2025`}
            delta={`${Math.abs(variacao(medio.anterior, medio.atual) ?? 0).toFixed(1).replace('.', ',')}%`}
            deltaDirection={medio.atual >= medio.anterior ? 'up' : 'down'}
            hint="Valor médio por boleto: receita GMV dividida pela quantidade de boletos." />
        )}
        {itensBoleto && (
          <KpiCard glow eyebrow="Itens por boleto" value={itensBoleto.atual.toFixed(2).replace('.', ',')} meta={`${itensBoleto.anterior.toFixed(2).replace('.', ',')} em 2025`}
            delta={`${Math.abs(variacao(itensBoleto.anterior, itensBoleto.atual) ?? 0).toFixed(1).replace('.', ',')}%`}
            deltaDirection={itensBoleto.atual >= itensBoleto.anterior ? 'up' : 'down'}
            hint="Média de itens em cada boleto." />
        )}
        {promoRede && (
          <KpiCard glow eyebrow="Boleto Promocional" value={pct(promoRede.convertidosPct, 2)} meta={`${fmtNumber(promoRede.convertidos)} de ${fmtNumber(promoRede.elegiveis)} elegíveis`}
            hint="Boletos convertidos ÷ boletos elegíveis, de Loja_Boleto promocional.xlsx." />
        )}
        {turboRede && (
          <KpiCard glow eyebrow="Boleto Turbinado" value={pct(turboRede.oficiaisPct, 2)} meta={`${fmtNumber(turboRede.oficiais)} oficiais em ${fmtNumber(turboRede.totalBoletos)} boletos`}
            hint="Turbinados oficiais ÷ total de boletos, de Loja_Boleto turbinado.xlsx." />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {promocional && (
          <ChartCard glow title="Conversão do Boleto Promocional" subtitle={nivel === 'pdv' ? '% dos boletos elegíveis, por loja' : '% dos boletos elegíveis, por consultor'}
            hint="Loja_Boleto promocional.xlsx. Conversão = boletos convertidos ÷ boletos elegíveis.">
            <RankingChart
              medals={false}
              items={[...promocional[nivel]].sort((a, b) => b.convertidosPct - a.convertidosPct).map(r => ({
                label: nomeDe(r.nome),
                value: r.convertidosPct,
                valueLabel: pct(r.convertidosPct),
                meta: `${fmtNumber(r.convertidos)} de ${fmtNumber(r.elegiveis)}`,
              }))}
            />
          </ChartCard>
        )}
        {turbinado && (
          <ChartCard glow title="Penetração do Boleto Turbinado" subtitle={nivel === 'pdv' ? '% do total de boletos, por loja' : '% do total de boletos, por consultor'}
            hint="Loja_Boleto turbinado.xlsx. Penetração = turbinados oficiais ÷ total de boletos, como no próprio arquivo.">
            <RankingChart
              medals={false}
              items={[...turbinado[nivel]].sort((a, b) => b.oficiaisPct - a.oficiaisPct).map(r => ({
                label: nomeDe(r.nome),
                value: r.oficiaisPct,
                valueLabel: pct(r.oficiaisPct),
                meta: `${fmtNumber(r.oficiais)} de ${fmtNumber(r.totalBoletos)}`,
              }))}
            />
          </ChartCard>
        )}
        {faixasValor.length > 0 && (
          <ChartCard glow title="Boletos por faixa de valor" subtitle="Rede toda, contra o mesmo ciclo de 2025" hint="Loja_Boleto.xlsx. Quantidade de boletos em cada faixa de valor.">
            <LojaTabela colunas={colunasResumo} linhas={faixasValor} chave={r => r.label} />
          </ChartCard>
        )}
        {faixasItens.length > 0 && (
          <ChartCard glow title="Boletos por quantidade de itens" subtitle="Rede toda, contra o mesmo ciclo de 2025" hint="Loja_Boleto.xlsx. 'Boleto 1' são os boletos com um item só, e assim por diante.">
            <LojaTabela colunas={colunasResumo} linhas={faixasItens} chave={r => r.label} />
          </ChartCard>
        )}
      </div>

      {itens && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow title="Distribuição de itens por boleto" subtitle={nivel === 'pdv' ? 'Por loja · clique na coluna para ordenar' : 'Por consultor · clique na coluna para ordenar'}
            hint="Loja_Distribuicao_de_itens_por_boleto.xlsx. Cada coluna é a % dos boletos com aquela quantidade de itens. Quanto mais peso à esquerda, mais boletos de um item só.">
            <LojaTabela colunas={colunasItens} linhas={itens[nivel]} chave={r => r.nome} ordemInicial={{ id: 'total', desc: true }} />
          </ChartCard>
        </div>
      )}

      {abastecimento && (
        <div style={{ marginTop: 20 }}>
          <ChartCard glow title="Abastecimento de promocionais e turbinados" subtitle="Da sugestão de pedido à venda real, em unidades"
            hint="Boletos_Visao_Abastecimento_Boletos_Promocionais_e_Turbinados.xlsx. Giro = venda real ÷ pedido faturado.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 16 }}>
              {[
                ['Sugestão', fmtNumber(abastecimento.metaSugestao)],
                ['Pedido realizado', fmtNumber(abastecimento.pedidoRealizado)],
                ['Pedido faturado', fmtNumber(abastecimento.pedidoFaturado)],
                ['Venda real', fmtNumber(abastecimento.vendaReal)],
                ['Giro', pct(abastecimento.giroPct)],
              ].map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <div style={{ fontSize: 12, color: 'var(--loja-text-secondary, #6B6258)' }}>{rotulo}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{valor}</div>
                </div>
              ))}
            </div>
            <Leitura>
              A rede pediu <strong>{pct(abastecimento.metaSugestao > 0 ? (abastecimento.pedidoRealizado / abastecimento.metaSugestao) * 100 : null, 0)}</strong> da
              sugestão e vendeu <strong>{pct(abastecimento.giroPct, 0)}</strong> do que foi faturado.
              {b1 && totalItensAtual > 0 && totalItensAnterior > 0 && (
                <> Boletos de um item só são {pct((b1.atual / totalItensAtual) * 100, 0)} do total, contra {pct((b1.anterior / totalItensAnterior) * 100, 0)} no ano passado.</>
              )}
            </Leitura>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaBoletosScreen;
