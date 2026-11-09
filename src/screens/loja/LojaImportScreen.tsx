import React, { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { parseLojaFiles } from '../../parsers/lojaParser';
import { useLojaStore } from '../../store/useLojaStore';
import { LOJA_DIMENSIONS, LOJA_DIMENSION_LABELS, LOJA_OPTIONAL_FILES, LOJA_OPTIONAL_FILE_LABELS, LojaParseResult } from '../../types/loja';

const DEFAULT_FILE_NAMES = [
  'GerencialVendas-07-11-2026CAIXAS.csv',
  'GerencialVendas-07-11-2026CANAL.csv',
  'GerencialVendas-07-11-2026CONSULTOR.csv',
  'GerencialVendas-07-11-2026DATA.csv',
  'GerencialVendas-07-11-2026FORMA.csv',
  'GerencialVendas-07-11-2026GESTAO.csv',
  'GerencialVendas-07-11-2026LOJAS.csv',
  'GerencialVendas-07-11-2026OPERADOR.csv',
  'GerencialVendas-07-11-2026SISTEMA.csv',
  'relatorioABCVenda.csv',
  'relatorioVendaPorHora.csv',
  '20261107_Boletos_Visao_Abastecimento_Boletos_Promocionais_e_Turbinados_da81d0f2f679.xlsx',
  '20261107_GestaoPedidos_Aderência_por_Categoria_338fdfcd0d6d.xlsx',
  '20261107_GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo_793dd5bedc8a.csv',
  '20261107_GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo_b15b9d92ad45.csv',
  '20261107_GestaoPedidos_Historico_Colocacao_Pedido_abc5abe88e6c.csv',
  '20261107_GestaoPedidos_Histórico_de_Aderência_26b99aec8c4f.xlsx',
  '20261107_GestaoPedidos_Meta_Sell_In_Por_Ciclo_7a747125b614.csv',
  '20261107_GestaoPedidos_Visao_Geral_por_Ciclo_479da759a8a3.csv',
  '20261107_ID_Cliente_Evolucao_Boletos_d6bed351bf05.xlsx',
  '20261107_Indicadores_ID_Cliente_d81d9e7e33de.xlsx',
  '20261107_LojaDigital_Conversao_por_ciclo_7b0986d10af1.xlsx',
  '20261107_LojaDigital_Performance_por_Pdv_Consultor_fa4364aa2bb8.xlsx',
  '20261107_LojaDigital_Receita_por_ciclo_75c4d7c15e6b.xlsx',
  '20261107_LojaDigital_Tme_por_ciclo_fe0584feb985.xlsx',
  '20261107_Loja_Boleto_040fc16f2fd4.xlsx',
  '20261107_Loja_Boleto_20promocional_fd65757f5371.xlsx',
  '20261107_Loja_Boleto_20turbinado_97406414cfb9.xlsx',
  '20261107_Loja_Distribuicao_Receita_Transacionada_Mobshop_056b7e7aa153.xlsx',
  '20261107_Loja_Distribuicao_da_receita_por_categoria_94ab9dc44cf2.xlsx',
  '20261107_Loja_Distribuicao_de_itens_por_boleto_a94288962e00.xlsx',
  '20261107_Loja_Indicadores_de_Loja_99af3f70669b.xlsx',
  '20261107_Loja_cuidados_faciais_iaf_48f37a7ab9ad.xlsx',
  '20261107_ProgramaFidelidade_Distribuicao_Penetracao_boleto_Fidelidade_44667258694e.xlsx',
  '20261107_ProgramaFidelidade_Distribuicao__25_Boletos_Identificados_Fidelidade_c07556a27105.xlsx',
  '20261107_ProgramaFidelidade_Distribuicao__25_Boletos_com_Resgate_8abca2a53f2f.xlsx',
  '20261107_ProgramaFidelidade_Evolucao__25_Boleto_com_Resgate_4e42a2ee82f8.xlsx',
  '20261107_ProgramaFidelidade_Evolucao__25_Boletos_Identificados_Fidelidade_8811d82e4453.xlsx',
  '20261107_ProgramaFidelidade_Evolucao__25_Penetracao_Desafio_Fidelidade_45678a568c20.xlsx',
  '20261107_ReceitaCanalLoja_Performance_por_PDV_f0f66aa49c86.xlsx',
  '20261107_ReceitaCanalLoja_por_UN_c6ebd87be2e6.xlsx',
  '20261107_Receita_por_Canal_UN_26fd321003b7.xlsx',
  '20261107_Receita_por_Cat_Sub_Mar_0b470d5bb013.xlsx',
  '20261107_RelatorioBso-GeradoDetalhePorPeriodo_e8e77b12ec82.xlsx',
  '20261107_RelatorioBso-GeradoPorCiclo_8f4685c23562.xlsx',
  '20261107_Resumo_de_Performance_Indicadores_Loja_dd2e0dacf258.xlsx',
  '20261107_RupturaVD_Ruptura_causa_franqueado_0ffdde09ddde.xlsx',
  '20261107_RupturaVD_Ruptura_detalhada_ciclo_c5243de9a763.xlsx',
  '20261107_RupturaVD_detalhamento_ruptura_por_item_6e4e78637c66.xlsx',
  '20261107_Servicos_em_loja_4b9f563ce211.xlsx',
  '20261107_TotalDeServicos_4fa3324cceaa.xlsx',
];

interface LojaImportScreenProps {
  onComplete: () => void;
}

const LojaImportScreen: React.FC<LojaImportScreenProps> = ({ onComplete }) => {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<LojaParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // true assim que o usuário mexe manualmente (upload ou "Limpar") — impede que o carregamento
  // automático dos arquivos padrão, se ainda estiver em andamento, sobrescreva silenciosamente o
  // que o usuário acabou de fazer quando a busca dos arquivos padrão terminar.
  const userInteractedRef = useRef(false);
  const setDataset = useLojaStore(s => s.setDataset);
  const clearDataset = useLojaStore(s => s.clearDataset);

  async function runParse(fileList: File[]) {
    setLoading(true);
    const r = await parseLojaFiles(fileList);
    setResult(r);
    setLoading(false);
    if (r.dataset) setDataset(r.dataset);
  }

  useEffect(() => {
    if (files.length > 0) return;
    let cancelled = false;
    setLoadingDefaults(true);
    Promise.all(
      DEFAULT_FILE_NAMES.map(name =>
        fetch(`/dados-padrao-loja/${encodeURIComponent(name)}`)
          .then(r => (r.ok ? r.blob() : null))
          .then(blob => (blob ? new File([blob], name, { type: blob.type }) : null))
          .catch(() => null)
      )
    ).then(async loaded => {
      if (cancelled) return;
      setLoadingDefaults(false);
      if (userInteractedRef.current) return;
      const valid = loaded.filter((f): f is File => f !== null);
      if (valid.length === 0) return;
      setFiles(valid);
      setLoading(true);
      const r = await parseLojaFiles(valid);
      if (cancelled || userInteractedRef.current) return;
      setResult(r);
      setLoading(false);
      if (r.dataset) {
        setDataset(r.dataset);
        onComplete();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(incoming: FileList | File[]) {
    userInteractedRef.current = true;
    const accepted = Array.from(incoming).filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    const merged = [...files];
    for (const f of accepted) {
      const idx = merged.findIndex(m => m.name === f.name);
      if (idx >= 0) merged[idx] = f; else merged.push(f);
    }
    setFiles(merged);
    runParse(merged);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
  }

  function handleClear() {
    userInteractedRef.current = true;
    setFiles([]);
    setResult(null);
    clearDataset();
    if (fileRef.current) fileRef.current.value = '';
  }

  const canProceed = !!result?.dataset;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      <PageTitle
        eyebrow="Modo Loja · Importar dados"
        title="Importar relatório gerencial"
        hint="Arraste os arquivos exportados do sistema gerencial (CSV e xlsx) — tudo é processado localmente no navegador, nada é enviado para um servidor."
      />
      <div style={{ marginBottom: 6 }} />
      <p style={{ color: 'var(--loja-text-secondary, #6B6258)', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        Arraste os <strong>7 arquivos CSV obrigatórios</strong> do relatório gerencial (Lojas, Forma, Consultor,
        Operador, Data, Canal e Gestão) e, se tiver, os arquivos <strong>opcionais</strong> (Curva ABC, Venda por
        Hora, Gestão de Pedidos, Resumo de Performance, Receita por Canal/Categoria — csv ou xlsx). Todos os
        dados são processados localmente no navegador.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${drag ? 'var(--loja-ink, #1C1814)' : 'var(--loja-border-strong, #D8D0C0)'}`,
          borderRadius: 20, padding: 40,
          background: drag ? 'var(--loja-bg, #FAF7F2)' : 'var(--loja-surface, #FFFFFF)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 40, color: 'var(--loja-text-muted, #9B9287)', marginBottom: 10 }}>
          <i className={loading || loadingDefaults ? 'ph ph-spinner' : 'ph ph-cloud-arrow-up'} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {loadingDefaults ? 'Carregando dados padrão...' : loading ? 'Processando arquivos...' : 'Arraste os arquivos aqui'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--loja-text-secondary, #6B6258)' }}>
          ou <span style={{ color: 'var(--loja-ink, #1C1814)', fontWeight: 600, textDecoration: 'underline' }}>selecione do computador</span>
        </div>
      </div>

      {/* Checklist */}
      <div style={{
        background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--loja-text-secondary, #6B6258)', marginBottom: 14, display: 'flex', alignItems: 'center' }}>
          Obrigatórios
          <InfoHint text="Os 7 arquivos CSV do relatório gerencial (Lojas, Forma, Consultor, Operador, Data, Canal, Gestão) — sem eles o Modo Loja não consegue montar o ranking." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LOJA_DIMENSIONS.map(dim => {
            const det = result?.detected[dim];
            return (
              <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: det ? 'var(--loja-success-bg, #E0F2E8)' : 'var(--loja-bg-subtle, #F2EEE2)',
                  color: det ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-text-muted, #9B9287)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>
                  <i className={det ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--loja-ink, #1C1814)' }}>{LOJA_DIMENSION_LABELS[dim]}</div>
                  {det && (
                    <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {det.fileName} · {det.rowCount} linhas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        background: 'var(--loja-surface, #FFFFFF)', border: '1px solid var(--loja-border, #E8E2D6)', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--loja-text-secondary, #6B6258)', marginBottom: 14, display: 'flex', alignItems: 'center' }}>
          Opcionais
          <InfoHint text="Arquivos extras que enriquecem outras telas (curva ABC, venda por hora, gestão de pedidos, Fidelidade, Loja Digital, Serviços em loja, Cuidados Faciais...) — o Modo Loja funciona sem eles, só mostra menos." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {LOJA_OPTIONAL_FILES.map(f => {
            const det = result?.detectedOptional[f];
            return (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: det ? 'var(--loja-success-bg, #E0F2E8)' : 'var(--loja-bg-subtle, #F2EEE2)',
                  color: det ? 'var(--loja-success, #2E7D5B)' : 'var(--loja-text-muted, #9B9287)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>
                  <i className={det ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--loja-ink, #1C1814)' }}>{LOJA_OPTIONAL_FILE_LABELS[f]}</div>
                  {det && (
                    <div style={{ fontSize: 11, color: 'var(--loja-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {det.fileName} · {det.rowCount} linhas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {result && result.errors.length > 0 && (
        <div style={{ background: 'var(--loja-warning-bg, #FBF3D0)', border: '1px solid var(--loja-warning-border, #E8C547)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--loja-warning-text, #5C4500)', marginBottom: 6 }}>
            {result.errors.length} aviso(s)
          </div>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--loja-warning-text, #5C4500)', fontFamily: 'JetBrains Mono, monospace' }}>{e}</div>
          ))}
        </div>
      )}

      {canProceed && (
        <div style={{ background: 'var(--loja-success-bg, #E0F2E8)', border: '1px solid var(--loja-success-bg-strong, #9FD4B8)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-bold ph-check-circle" style={{ color: 'var(--loja-success, #2E7D5B)', fontSize: 18 }} />
          <div style={{ fontSize: 13, color: 'var(--loja-success-text-strong, #0E3A2A)' }}>
            Todos os arquivos foram reconhecidos. Pronto para gerar o ranking.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button variant="ghost" size="lg" onClick={handleClear}>Limpar</Button>
        <Button variant="primary" size="lg" disabled={!canProceed} onClick={onComplete}>
          Ver ranking
        </Button>
      </div>
    </div>
  );
};

export default LojaImportScreen;
