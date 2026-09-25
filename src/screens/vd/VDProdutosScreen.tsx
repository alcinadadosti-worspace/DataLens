import React, { useMemo, useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import RankingChart from '../../components/charts/RankingChart';
import { RankingItem } from '../../components/charts/RankingList';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtBRL, fmtNumber } from '../../utils/formatters';
import { pillBtn } from './pillBtn';
import { exportToCSV } from '../../services/exportService';

interface Props {
  onNavigate: (route: string) => void;
  onResellerClick: (id: string, name: string) => void;
}

const TIPOS = ['Venda', 'Brinde', 'Doação'] as const;

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

const VDProdutosScreen: React.FC<Props> = ({ onNavigate, onResellerClick }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const rows = dataset?.rankingVendas ?? [];
  const [tipo, setTipo] = useState<typeof TIPOS[number]>('Venda');

  const filtered = useMemo(() => rows.filter(r => r.tipo === tipo), [rows, tipo]);

  const stats = useMemo(() => {
    const byTipo: Record<string, number> = {};
    for (const r of rows) byTipo[r.tipo] = (byTipo[r.tipo] ?? 0) + r.quantidadeItens;
    return byTipo;
  }, [rows]);

  const topProdutos: RankingItem[] = useMemo(() => {
    const byProduto: Record<string, { nome: string; faturamento: number; qtd: number }> = {};
    for (const r of filtered) {
      const key = r.codigoProduto;
      if (!byProduto[key]) byProduto[key] = { nome: r.nomeProduto, faturamento: 0, qtd: 0 };
      byProduto[key].faturamento += r.valorPraticado;
      byProduto[key].qtd += r.quantidadeItens;
    }
    return Object.entries(byProduto)
      .sort((a, b) => b[1].faturamento - a[1].faturamento)
      .slice(0, 15)
      .map(([codigo, d]) => ({
        id: codigo,
        label: d.nome,
        sublabel: `#${codigo}`,
        value: d.faturamento,
        valueLabel: fmtBRL(d.faturamento),
        meta: `${fmtNumber(d.qtd)} un.`,
      }));
  }, [filtered]);

  const topRevendedores = useMemo(() => {
    const byRevendedor: Record<string, { nome: string; faturamento: number; qtd: number }> = {};
    for (const r of filtered) {
      const key = r.codigoRevendedora;
      if (!byRevendedor[key]) byRevendedor[key] = { nome: r.nomeRevendedora, faturamento: 0, qtd: 0 };
      byRevendedor[key].faturamento += r.valorPraticado;
      byRevendedor[key].qtd += r.quantidadeItens;
    }
    return Object.entries(byRevendedor)
      .sort((a, b) => b[1].faturamento - a[1].faturamento)
      .slice(0, 15)
      .map(([codigo, d]) => ({ codigo, nome: d.nome, faturamento: d.faturamento, qtd: d.qtd }));
  }, [filtered]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-shopping-bag" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de ranking de produtos</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Importe o arquivo ConsultaRankingVendas.csv (grão item vendido) para ver produto, mix e revendedor.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const totalFaturamento = filtered.reduce((s, r) => s + r.valorPraticado, 0);
  const totalItens = filtered.reduce((s, r) => s + r.quantidadeItens, 0);

  function exportFiltered() {
    exportToCSV(
      filtered.map(r => ({
        'Código Produto': r.codigoProduto, 'Nome Produto': r.nomeProduto, Tipo: r.tipo,
        'Código Revendedora': r.codigoRevendedora, 'Nome Revendedora': r.nomeRevendedora,
        'Quantidade Itens': r.quantidadeItens, Faturamento: r.faturamento, 'Valor Praticado': r.valorPraticado,
        'Meio Captação': r.meioCaptacao, 'Data Captação': r.dataCaptacao,
      })),
      `datalens-produtos-${tipo.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Produtos</h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Ranking por item vendido ({fmtNumber(rows.length)} linhas) — grão de produto, não de pedido.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setTipo(t)} className={`glossy-btn${tipo === t ? ' glossy-active' : ''}`} style={pillBtn(tipo === t)}>
            <GlossyContent compact>
              {t} <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginLeft: 4 }}>({fmtNumber(stats[t] ?? 0)})</span>
            </GlossyContent>
          </button>
        ))}
        <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportFiltered}>
          Exportar CSV
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard
          eyebrow={`Faturamento (${tipo})`}
          value={fmtBRL(totalFaturamento)}
          hint={`Soma da coluna 'ValorPraticado' de ConsultaRankingVendas.csv, só as linhas com Tipo = '${tipo}'. ${tipo !== 'Venda' ? 'Brinde/Doação costumam ter ValorPraticado = 0 — o total aqui reflete isso.' : ''}`}
        />
        <KpiCard
          eyebrow="Itens"
          value={fmtNumber(totalItens)}
          hint={`Soma da coluna 'QuantidadeItens' das linhas filtradas (Tipo = '${tipo}') — quantidade física, não faturamento.`}
        />
        <KpiCard
          eyebrow="Ticket médio por item"
          value={fmtBRL(totalItens > 0 ? totalFaturamento / totalItens : 0)}
          hint="Calculado por nós: faturamento filtrado ÷ itens filtrados. Não vem pronto do arquivo."
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard
          title="Top produtos"
          subtitle={`Por faturamento — ${tipo}`}
          hint="Agrupamos ConsultaRankingVendas.csv por CodigoProduto (dentro do Tipo selecionado), somando ValorPraticado e QuantidadeItens de cada produto, e ordenamos pelo faturamento somado — top 15. Abra em tela cheia pra ver como pizza, treemap ou outras visualizações."
        >
          <RankingChart items={topProdutos} mode="vd" medals initialCategory="bar" emptyMessage="Sem produtos neste filtro" />
        </ChartCard>

        <ChartCard
          title="Top revendedores"
          subtitle={`Por faturamento — ${tipo}`}
          hint="Agrupamos as mesmas linhas por CodigoRevendedora, somando ValorPraticado — top 15. Clique num revendedor para ver os pedidos dele na tela de Pedidos (cruza CodigoRevendedora com Order.Pessoa)."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topRevendedores.map((r, i) => (
              <div
                key={r.codigo}
                onClick={() => onResellerClick(r.codigo, r.nome)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--vd-bg-subtle, #F2EEE2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', width: 20 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{fmtBRL(r.faturamento)}</span>
              </div>
            ))}
            {topRevendedores.length === 0 && (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--vd-text-muted, #9B9287)', fontSize: 14 }}>Sem revendedores neste filtro</div>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default VDProdutosScreen;
