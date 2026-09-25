import React from 'react';
import ChartCard from '../../components/charts/ChartCard';

interface Term {
  sigla: string;
  significado: string;
  confirmado: boolean;
}

const GLOSSARIO: Record<string, Term> = {
  iaf: {
    sigla: 'IAF',
    significado: 'Aparece em "% RUPTURA CF (IAF)" — provavelmente "Item(ns) de Alta Frequência", mas não confirmado com quem gera o relatório.',
    confirmado: false,
  },
  cgb: {
    sigla: 'CGB',
    significado: 'Aparece no nome da aba "SEGMENTAÇÃO DA BASE CGB" — significado não confirmado.',
    confirmado: false,
  },
  cp: {
    sigla: 'CP',
    significado: 'Código do Ponto — identifica a franquia/CP dona dos relatórios (constante em todos os arquivos deste lote). Confirmado pela aba FILTROS de cada arquivo.',
    confirmado: true,
  },
  rpa: {
    sigla: 'RPA',
    significado: 'Receita Por Ativo — receita total dividida pelo número de revendedores ativos. Confirmado pelo próprio cabeçalho da coluna ("RPA (REAIS POR ATIVO)").',
    confirmado: true,
  },
  pef: {
    sigla: 'Meta PEF',
    significado: 'Meta acordada com o franqueado para o ciclo (aparece em vários relatórios de receita: "META PEF (R$)"). Origem exata da sigla não confirmada.',
    confirmado: false,
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
