import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/loja/RankingChart';
import Button from '../../components/ui/Button';
import { useLojaStore } from '../../store/useLojaStore';
import { useAbcOverridesStore } from '../../store/useAbcOverridesStore';
import { classifyAbc, classifyAbcByLoja, AbcAggregatedItem } from '../../analytics/lojaMetrics';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { fmtBRLshort } from '../../utils/formatters';

const CLASS_HINT: Record<'A' | 'B' | 'C', string> = {
  A: 'Classe A: os itens que, somados, respondem pelos primeiros ~80% do faturamento — o núcleo do portfólio, prioridade máxima de estoque/preço.',
  B: 'Classe B: itens intermediários, que somados aos da Classe A chegam a ~95% do faturamento acumulado.',
  C: 'Classe C: os itens de menor peso individual no faturamento — cauda longa do portfólio (últimos ~5% acumulados).',
};

const CLASS_COLOR: Record<'A' | 'B' | 'C', { bg: string; color: string }> = {
  A: { bg: '#E0F2E8', color: '#2E7D5B' },
  B: { bg: '#FBF3D0', color: '#8A6D00' },
  C: { bg: '#F2EEE2', color: '#6B6258' },
};

function parseComercialFlag(raw: string): boolean {
  const v = raw.trim().toUpperCase();
  return v === 'S' || v === 'SIM' || v === 'TRUE' || v === '1' || v === 'COMERCIAL';
}

const LojaAbcScreen: React.FC<{ onNavigate: (r: string) => void }> = ({ onNavigate }) => {
  const dataset = useLojaStore(s => s.dataset);
  const overrides = useAbcOverridesStore(s => s.overrides);
  const setOverride = useAbcOverridesStore(s => s.setOverride);
  const clearOverride = useAbcOverridesStore(s => s.clearOverride);
  const importOverrides = useAbcOverridesStore(s => s.importOverrides);
  const clearAllOverrides = useAbcOverridesStore(s => s.clearAll);
  const [comercialOnly, setComercialOnly] = useState(true);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const abcRows = dataset?.abc ?? [];
  const classified = useMemo(() => classifyAbc(abcRows, comercialOnly, overrides), [abcRows, comercialOnly, overrides]);
  const byLoja = useMemo(() => classifyAbcByLoja(abcRows, overrides), [abcRows, overrides]);

  if (!dataset) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>Importe os dados para ver a curva ABC.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar dados</Button>
      </div>
    );
  }

  if (!dataset.abc || dataset.abc.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6B6258', fontSize: 15, marginBottom: 24 }}>
          O arquivo <strong>relatorioABCVenda</strong> não foi importado neste lote — curva ABC indisponível.
        </p>
        <Button variant="primary" size="lg" onClick={() => onNavigate('loja-import')}>Importar arquivo</Button>
      </div>
    );
  }

  const hasLojaBreakdown = byLoja.size > 0;

  const counts = { A: 0, B: 0, C: 0 };
  for (const a of classified) counts[a.classe]++;

  const riscoMargem = classified.filter(a => a.classe === 'A' && a.margem < 20).slice(0, 8);
  const overrideCount = Object.keys(overrides).length;

  function handleImportReferenceList(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as string[][];
        if (rows.length === 0) return;
        const header = rows[0].map(h => h.trim().toUpperCase());
        const hasHeader = header.includes('CODIGO') || header.includes('CÓDIGO');
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const entries: Record<string, boolean> = {};
        for (const r of dataRows) {
          const codigo = (r[0] ?? '').trim();
          if (!codigo) continue;
          entries[codigo] = parseComercialFlag(r[1] ?? '');
        }
        importOverrides(entries);
        setImportMsg(`${Object.keys(entries).length} SKU(s) importado(s) da lista de referência.`);
      },
    });
    if (refFileRef.current) refFileRef.current.value = '';
  }

  function handleExportOverrides() {
    const rows = [['codigo', 'comercial'], ...Object.entries(overrides).map(([codigo, v]) => [codigo, v ? 'S' : 'N'])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classificacao-abc-manual.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleOverride(item: AbcAggregatedItem) {
    // Ciclo: auto (heurística) -> forçar comercial -> forçar não-comercial -> volta pro auto
    if (!item.isOverridden) {
      setOverride(item.codigo, true);
    } else if (overrides[item.codigo] === true) {
      setOverride(item.codigo, false);
    } else {
      clearOverride(item.codigo);
    }
  }

  const topItems = classified.slice(0, 25);

  return (
    <div style={{ padding: '32px 32px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <PageTitle
          eyebrow="Modo Loja"
          title="Curva ABC de produtos"
          hint="ABC é a classificação de produtos pela importância no faturamento acumulado: Classe A (essenciais), B (intermediários) e C (cauda longa)."
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3D362E', cursor: 'pointer' }}>
          <input type="checkbox" checked={comercialOnly} onChange={e => setComercialOnly(e.target.checked)} />
          Excluir sacolas/amostras/PRM
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 24 }}>
        {(['A', 'B', 'C'] as const).map(c => (
          <div key={c} style={{ background: CLASS_COLOR[c].bg, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: CLASS_COLOR[c].color, display: 'flex', alignItems: 'center' }}>
              Classe {c}
              <InfoHint text={CLASS_HINT[c]} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#1C1814', marginTop: 4 }}>{counts[c]}</div>
            <div style={{ fontSize: 12, color: '#6B6258' }}>SKUs</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginTop: 24 }}>
        <ChartCard
          title="Top produtos por faturamento"
          hint="Os produtos (SKUs) que mais faturaram no período, com a classe ABC de cada um e o % acumulado no ranking."
          subtitle={comercialOnly ? 'Somente itens comerciais — clique no ícone para corrigir a classificação' : 'Todos os itens, incluindo sacolas/amostras'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topItems.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9B9287', fontSize: 13 }}>Sem dados</div>
            ) : topItems.map((a, i) => (
              <div key={a.codigo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 11, fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#F2EEE2', color: '#6B6258',
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.descricao || a.codigo}
                    <span style={{ fontWeight: 400, color: '#9B9287', marginLeft: 6, fontSize: 12 }}>{a.codigo}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9B9287' }}>
                    Classe {a.classe} · {a.participacaoAcumuladaPct.toFixed(0)}% acum.
                    {a.isOverridden && <span style={{ color: '#B26A3C', marginLeft: 6 }}>· classificação manual</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                  {fmtBRLshort(a.faturamento)}
                </div>
                <button
                  onClick={() => toggleOverride(a)}
                  title={a.isOverridden ? (overrides[a.codigo] ? 'Marcado manualmente como comercial — clique para marcar não-comercial' : 'Marcado manualmente como não-comercial — clique para voltar ao automático') : 'Marcar classificação manualmente'}
                  style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: '1px solid #E8E2D6',
                    background: a.isOverridden ? (overrides[a.codigo] ? '#E0F2E8' : '#F2EEE2') : 'white',
                    color: a.isOverridden ? (overrides[a.codigo] ? '#2E7D5B' : '#6B6258') : '#9B9287',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}
                >
                  <i className={a.isComercial ? 'ph ph-tag' : 'ph ph-gift'} />
                </button>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Classe A com margem baixa"
          hint="Produtos essenciais (Classe A) vendidos com margem de lucro abaixo de 20% — risco de estar vendendo muito volume com pouco lucro."
          subtitle="Risco de precificação (margem < 20%)"
        >
          {riscoMargem.length === 0 ? (
            <div style={{ color: '#6B6258', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ph ph-check-circle" style={{ color: '#2E7D5B', fontSize: 18 }} />
              Nenhum item de Classe A com margem abaixo de 20%.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {riscoMargem.map((a, i) => (
                <div key={i} style={{ background: '#FBE5E9', border: '1px solid #F0A8B3', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#5C0F1A' }}>{a.descricao || a.codigo}</div>
                  <div style={{ fontSize: 12, color: '#8A1426', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    Margem {a.margem.toFixed(1).replace('.', ',')}% · {fmtBRLshort(a.faturamento)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Classificação manual de itens"
          hint="PRM é o sufixo usado pelo sistema de origem para identificar brindes/amostras. Aqui você corrige, item a item, se algo foi classificado errado pela heurística automática."
          subtitle="Corrija exceções da heurística automática (sufixo PRM / preço < R$3) sem depender de um novo arquivo-fonte"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#3D362E' }}>
              {overrideCount === 0 ? 'Nenhum SKU classificado manualmente ainda.' : `${overrideCount} SKU(s) com classificação manual.`}
            </span>
            <input ref={refFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportReferenceList} />
            <Button size="md" variant="secondary" onClick={() => refFileRef.current?.click()}>
              Importar lista de referência (.csv)
            </Button>
            <Button size="md" variant="ghost" onClick={handleExportOverrides} disabled={overrideCount === 0}>
              Exportar classificação atual
            </Button>
            {overrideCount > 0 && (
              <Button size="md" variant="ghost" onClick={clearAllOverrides}>
                Limpar todas
              </Button>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9B9287', marginTop: 10 }}>
            Formato esperado: colunas <code>codigo,comercial</code> (S/N) — uma linha por SKU. A lista é salva no
            navegador e reaplicada automaticamente em futuras importações.
          </div>
          {importMsg && (
            <div style={{ fontSize: 12, color: '#2E7D5B', marginTop: 8 }}>{importMsg}</div>
          )}
        </ChartCard>
      </div>

      {hasLojaBreakdown && (
        <div style={{ marginTop: 20 }}>
          <ChartCard
            title="Top produtos por loja"
            hint="Mesmo ranking de faturamento por produto, agora aberto loja a loja — só aparece quando o arquivo de origem já vem quebrado por loja."
            subtitle="Disponível porque o arquivo veio aberto por loja (Quebra2 preenchida)"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              {Array.from(byLoja.entries()).slice(0, 6).map(([loja, items]) => (
                <div key={loja}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{loja}</div>
                  <RankingChart
                    medals={false}
                    items={items.slice(0, 5).map(a => ({
                      label: a.descricao || a.codigo,
                      value: a.faturamento,
                      valueLabel: fmtBRLshort(a.faturamento),
                      meta: `Classe ${a.classe}`,
                    }))}
                  />
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default LojaAbcScreen;
