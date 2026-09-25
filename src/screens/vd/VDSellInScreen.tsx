import React, { useState } from 'react';
import KpiCard from '../../components/ui/KpiCard';
import ChartCard from '../../components/charts/ChartCard';
import Button from '../../components/ui/Button';
import GlossyContent from '../../components/ui/GlossyContent';
import { useVDCorporateStore } from '../../store/useVDCorporateStore';
import { fmtNumber } from '../../utils/formatters';
import { pillBtn } from './pillBtn';
import { exportToCSV } from '../../services/exportService';

interface Props {
  onNavigate: (route: string) => void;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vd-text-secondary, #6B6258)', borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--vd-border, #E8E2D6)' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' };

const VDSellInScreen: React.FC<Props> = ({ onNavigate }) => {
  const dataset = useVDCorporateStore(s => s.dataset);
  const [pdvFilter, setPdvFilter] = useState<string | null>(null);

  const meta = dataset?.sellInMeta?.[0];
  const detalhe = dataset?.sellInDetalheSku ?? [];
  const pdvs = Array.from(new Set(detalhe.map(d => d.pdvCodigo))).sort();
  const filtered = pdvFilter ? detalhe.filter(d => d.pdvCodigo === pdvFilter) : detalhe;

  if (!meta && detalhe.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, color: 'var(--vd-border-strong, #D8D0C0)', marginBottom: 16 }}><i className="ph ph-package" /></div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Sem dados de Sell-In</h2>
        <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginBottom: 24 }}>
          Sell-In é a reposição de estoque do franqueado junto à indústria — domínio que não existe
          nos pedidos ao consumidor final. Importe os arquivos de Gestão de Pedidos / Meta Sell-In.
        </p>
        <Button variant="primary" onClick={() => onNavigate('import')}>Importar planilhas</Button>
      </div>
    );
  }

  const atingimentoGeral = meta && meta.sugestaoComercial > 0 ? (meta.pedidoRealizado / meta.sugestaoComercial) * 100 : 0;
  const skusAbaixoMeta = detalhe.filter(d => d.atingimentoMetaPct < 100).length;

  function exportDetalhe() {
    exportToCSV(
      filtered.map(r => ({
        PDV: r.pdvCodigo, 'Código SKU': r.skuCodigo, 'Descrição SKU': r.skuDescricao, Marca: r.marca,
        'Sugestão Comercial': r.sugestaoComercial, 'Pedido Realizado': r.pedidoRealizado, '% Atingimento': r.atingimentoMetaPct,
      })),
      `datalens-sellin-detalhamento-${new Date().toISOString().slice(0, 10)}`
    );
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Dados corporativos
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>Sell-In</h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 14, marginTop: 0, marginBottom: 28 }}>
        Reposição de estoque do franqueado junto à indústria — não confundir com vendas ao consumidor final (Sell-Out).
      </p>

      {meta && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            eyebrow="Sugestão comercial"
            value={fmtNumber(meta.sugestaoComercial)}
            meta="unidades"
            hint="Coluna 'SUGESTÃO COMERCIAL' de GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv — 1 linha só, total da rede (soma os 2 PDVs), vinda pronta do sistema de origem."
          />
          <KpiCard
            eyebrow="Pedido realizado"
            value={fmtNumber(meta.pedidoRealizado)}
            meta="unidades"
            hint="Coluna 'PEDIDO REALIZADO' do mesmo arquivo e mesma linha — quanto o franqueado de fato pediu à indústria neste ciclo."
          />
          <KpiCard
            eyebrow="Atingimento da meta"
            value={`${atingimentoGeral.toFixed(1).replace('.', ',')}%`}
            delta={skusAbaixoMeta > 0 ? `${skusAbaixoMeta} SKU(s) abaixo de 100%` : 'Todos os SKUs na meta'}
            deltaDirection={skusAbaixoMeta > 0 ? 'down' : 'up'}
            hint="Calculado por nós (Pedido Realizado ÷ Sugestão Comercial × 100), não vem pronto do arquivo total — o arquivo de detalhamento por SKU já traz esse % pronto por linha, usado no delta."
          />
        </div>
      )}

      {detalhe.length > 0 && (
        <ChartCard
          title="Detalhamento por SKU"
          subtitle={`${filtered.length} de ${detalhe.length} linhas`}
          hint="GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv — grão Ciclo × PDV × SKU (8 SKUs × 2 PDVs = 16 linhas neste lote). A coluna 'SKU' vem como texto único '<código> - <nome>'; nós separamos o código do nome antes de exibir. '% Atingimento' é lido direto da coluna do arquivo, não recalculado."
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setPdvFilter(null)} className={`glossy-btn${pdvFilter === null ? ' glossy-active' : ''}`} style={pillBtn(pdvFilter === null)}>
                  <GlossyContent compact>Todos</GlossyContent>
                </button>
                {pdvs.map(pdv => (
                  <button key={pdv} onClick={() => setPdvFilter(pdv)} className={`glossy-btn${pdvFilter === pdv ? ' glossy-active' : ''}`} style={pillBtn(pdvFilter === pdv)}>
                    <GlossyContent compact>PDV {pdv}</GlossyContent>
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" icon={<i className="ph ph-file-csv" style={{ fontSize: 14 }} />} onClick={exportDetalhe}>
                CSV
              </Button>
            </div>
          }
        >
          <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>PDV</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Marca</th>
                  <th style={{ ...th, textAlign: 'right' }}>Sugestão</th>
                  <th style={{ ...th, textAlign: 'right' }}>Realizado</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Atingimento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{r.pdvCodigo}</td>
                    <td style={{ ...td, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.skuDescricao}>
                      <span style={{ color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginRight: 6 }}>{r.skuCodigo}</span>
                      {r.skuDescricao}
                    </td>
                    <td style={td}>{r.marca}</td>
                    <td style={tdNum}>{fmtNumber(r.sugestaoComercial)}</td>
                    <td style={tdNum}>{fmtNumber(r.pedidoRealizado)}</td>
                    <td style={{ ...tdNum, color: r.atingimentoMetaPct < 100 ? 'var(--vd-danger, #B83A3A)' : 'var(--vd-success, #2E7D5B)', fontWeight: 600 }}>
                      {r.atingimentoMetaPct.toFixed(1).replace('.', ',')}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
};

export default VDSellInScreen;
