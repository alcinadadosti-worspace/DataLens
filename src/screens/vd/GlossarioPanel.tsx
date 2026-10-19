import React from 'react';
import ChartCard from '../../components/charts/ChartCard';

interface Term {
  sigla: string;
  significado: string;
  confirmado: boolean;
}

const GLOSSARIO: Record<string, Term> = {
  cp: {
    sigla: 'CP',
    significado: 'Código Pai — identifica a franquia dona dos relatórios (constante em todos os arquivos deste lote). Aparece na aba FILTROS de cada arquivo.',
    confirmado: true,
  },
  rpa: {
    sigla: 'RPA',
    significado: 'Real por Ativo — receita total dividida pelo número de revendedores ativos (no relatório, a coluna "RPA (REAIS POR ATIVO)").',
    confirmado: true,
  },
  pef: {
    sigla: 'Meta PEF',
    significado: 'PEF = Ponto de Equilíbrio Financeiro. A Meta PEF é a receita que o ciclo precisa atingir para chegar a esse ponto de equilíbrio (aparece nos relatórios de receita como "META PEF (R$)").',
    confirmado: true,
  },
  er: {
    sigla: 'ER',
    significado: 'Espaço do Revendedor — o site/app de pedidos da revendedora. Aparece em "ativas_uma_compra_er" e "Ativas com pelo menos uma compra no ER".',
    confirmado: true,
  },
  optout: {
    sigla: 'Opt-out de catálogo',
    significado: 'Revendedora que optou por não receber o catálogo impresso. Os relatórios BaseComOptOutDeCatalogo trazem só o opt-out "BOT" (O Boticário).',
    confirmado: true,
  },
  giro: {
    sigla: 'Giro',
    significado: 'Venda real ÷ pedido faturado, em unidades — quanto do estoque reposto no ciclo já foi vendido às revendedoras. Confirmado pela conta: os números da Visão geral de pedidos reproduzem o % do arquivo.',
    confirmado: true,
  },
  aderencia: {
    sigla: 'Aderência por curva',
    significado: 'Quanto do pedido sugerido foi seguido em cada curva de produtos: curva A = produtos de maior giro, curva E = produtos de menor giro. O percentual já vem calculado no arquivo.',
    confirmado: true,
  },
};

interface Props {
  termos: (keyof typeof GLOSSARIO)[];
}

/** Painel de glossário — siglas marcadas como não confirmadas continuam sem confirmação até alguém da área de negócio validar (ver LEITURA_PLANILHAS_VD.md §6.7). */
const GlossarioPanel: React.FC<Props> = ({ termos }) => {
  const items = termos.map(t => GLOSSARIO[t]).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <ChartCard
      title="Glossário"
      subtitle="Siglas usadas nesta tela"
      hint="Definições melhor esforço, lidas do contexto dos próprios arquivos — as marcadas como não confirmadas ainda precisam de validação com quem gera os relatórios de origem."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(t => (
          <div key={t.sigla} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
              color: 'var(--vd-ink, #1C1814)', background: 'var(--vd-bg-subtle, #F2EEE2)',
              borderRadius: 6, padding: '2px 8px', flexShrink: 0, minWidth: 48, textAlign: 'center',
            }}>
              {t.sigla}
            </span>
            <div>
              <div style={{ fontSize: 12, color: 'var(--vd-text-secondary, #6B6258)' }}>{t.significado}</div>
              {!t.confirmado && (
                <div style={{ fontSize: 11, color: 'var(--vd-warning-strong, #C9A227)', marginTop: 2, fontWeight: 600 }}>
                  Não confirmado com a área de negócio
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
};

export default GlossarioPanel;
