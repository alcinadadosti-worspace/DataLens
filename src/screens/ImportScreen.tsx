import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import { parseVDFiles, VDImportResult } from '../parsers/vdImport';
import { useOrderStore } from '../store/useOrderStore';
import { useVDCorporateStore } from '../store/useVDCorporateStore';
import { useVDHistoryStore } from '../store/useVDHistoryStore';
import { useFilterStore } from '../store/useFilterStore';
import { VDCorporateFile, VD_CORPORATE_FILE_LABELS } from '../types/vdCorporate';
import { buildVDSnapshot, dominantCiclo } from '../analytics/vdSnapshot';

interface ImportScreenProps {
  onComplete: () => void;
}

type Phase = 'idle' | 'loading' | 'done' | 'error';

// 'receitaCanalVDPeriodo' (ReceitaCanalVD_por_Periodo, Ciclo 13) saiu da lista: a partir do Ciclo 14 a Extranet
// exporta ReceitaCanalVD_por_Ciclo no lugar. O parser ainda lê o arquivo antigo, se alguém importar.
const OPTIONAL_FILES: VDCorporateFile[] = [
  'rankingVendas',
  'sellInMeta',
  'sellInDetalheSku',
  'pedidosVisaoGeral',
  'pedidosGiro',
  'pedidosColocacao',
  'aderencia',
  'receitaCanalVDPdv',
  'receitaCanalVDUn',
  'receitaCanalVDCiclo',
  'receitaPeriodo',
  'receitaCanalUn',
  'receitaCategoria',
  'vdReceitaCiclo',
  'distribuicaoReceita',
  'receitaUnGmv',
  'receitaCategoriaMix',
  'arvorePedidos',
  'performancePdvSupervisor',
  'rupturaCausaFranqueado',
  'rupturaDetalhada',
  'rupturaPorItem',
  'evolucaoBase',
  'monitoramentoBase',
  'penetracaoBase',
  'penetracaoAtivosDetalhada',
  'ativasPorTier',
  'segmentacaoBase',
  'detalhamentoCategoriasUn',
  'ativasCanaisDigitais',
  'ativasEspacoRevendedor',
  'ferramentasDigitaisPdv',
  'optOutBase',
  'optOutDetalhe',
  'optOutPdv',
];

const DEFAULT_FILE_NAMES = [
  'ConsultaPedidos.xlsx',
  'ConsultaRankingVendas.csv',
  '20261016_BaseComOptOutDeCatalogo_Base_Total_Com_E_Sem_Opt_Out_b1f446277d02.xlsx',
  '20261016_BaseComOptOutDeCatalogo_Det_Base_Total_Com_Opt_Out_22058d30b656.xlsx',
  '20261016_BaseComOptOutDeCatalogo_Opt_Out_de_Catalogos_BOT_por_PDV_01b74e05a78c.xlsx',
  '20261016_GestaoPedidos_Aderência_por_Categoria_dff25dd2094e.xlsx',
  '20261016_GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo_206c5b74fa71.csv',
  '20261016_GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo_f94db448218a.csv',
  '20261016_GestaoPedidos_Historico_Colocacao_Pedido_57ac1d775805.csv',
  '20261016_GestaoPedidos_Histórico_de_Aderência_5953823338d7.xlsx',
  '20261016_GestaoPedidos_Meta_Sell_In_Por_Ciclo_fcf69ab9406c.csv',
  '20261016_GestaoPedidos_Visao_Geral_por_Ciclo_caea0f8bbf54.csv',
  '20261016_Monitoramento_base_com_penetracao_em_ferramentas_digitais_pdv_7d6c7f3785fe.xlsx',
  '20261016_ReceitaCanalVD_Performance_por_PDV_fb9f995f4667.xlsx',
  '20261016_ReceitaCanalVD_por_Ciclo_167f111608ab.xlsx',
  '20261016_ReceitaCanalVD_por_UN_1e3f8550c904.xlsx',
  '20261016_Receita_por_Canal_UN_1f26cbec9d95.xlsx',
  '20261016_Receita_por_Cat_Sub_Mar_0f829af28ff0.xlsx',
  '20261016_Receita_por_Ciclo_58489d8f32f7.xlsx',
  '20261016_RupturaVD_Ruptura_causa_franqueado_0f6945be1c4a.xlsx',
  '20261016_RupturaVD_Ruptura_detalhada_ciclo_4828145f8c70.xlsx',
  '20261016_RupturaVD_detalhamento_ruptura_por_item_56ddaaebf96c.xlsx',
  '20261016_VendaDireta_Arvore_De_Pedidos_65b8c2493572.xlsx',
  '20261016_VendaDireta_Ativas_por_tier_3377e0acbc8a.xlsx',
  '20261016_VendaDireta_Detalhamento_de_Categorias_e_UN_no_Periodo_de_Ciclos_28c3bcf0fcfa.xlsx',
  '20261016_VendaDireta_Distribuicao_da_Receita_581a752d231b.xlsx',
  '20261016_VendaDireta_Distribuicao_da_receita_por_categoria_47299acbb849.xlsx',
  '20261016_VendaDireta_Evolucao_da_base_751fa07d0bd4.xlsx',
  '20261016_VendaDireta_Monitoramento_base_PDV_Supervisor_2bc469f01610.xlsx',
  '20261016_VendaDireta_Penetracao_de_Ativos_Detalhada_969cb399f09b.xlsx',
  '20261016_VendaDireta_Performance_PDV_Supervisor_7b7938627f17.xlsx',
  '20261016_VendaDireta_Receita_Por_UN_7ddbe0f68c73.xlsx',
  '20261016_VendaDireta_Receita_por_Ciclo_d61ebae19f63.xlsx',
  '20261016_VendaDireta_Segmentacao_da_Base_4bc3f774d429.xlsx',
  '20261016_VendaDireta_penetracao_base_cd0332120206.xlsx',
  '20261016_ativas_uma_compra_canais_digitais_00d987068954.xlsx',
  '20261016_ativas_uma_compra_er_667be7987584.xlsx',
];

/**
 * Último lote importado nesta sessão. A tela é desmontada ao navegar para outra rota; sem isso, voltar
 * em "Importar" começava do zero, buscava de novo os dados padrão e, ao terminar, chamava `onComplete`
 * e jogava o usuário de volta para a Visão geral no meio do que ele ia fazer.
 */
let ultimoLote: { files: File[]; result: VDImportResult } | null = null;

const ImportScreen: React.FC<ImportScreenProps> = ({ onComplete }) => {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>(() => ultimoLote?.files ?? []);
  const [result, setResult] = useState<VDImportResult | null>(() => ultimoLote?.result ?? null);
  const [phase, setPhase] = useState<Phase>(() => (ultimoLote?.result.orders?.length ? 'done' : 'idle'));
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const userInteractedRef = useRef(false);
  const setOrders = useOrderStore(s => s.setOrders);
  const clearOrders = useOrderStore(s => s.clearOrders);
  const setCorporateDataset = useVDCorporateStore(s => s.setDataset);
  const clearCorporateDataset = useVDCorporateStore(s => s.clearDataset);
  const clearFilters = useFilterStore(s => s.clearFilters);
  const addSnapshot = useVDHistoryStore(s => s.addSnapshot);

  async function runParse(fileList: File[]) {
    setPhase('loading');
    const r = await parseVDFiles(fileList);
    setResult(r);
    ultimoLote = { files: fileList, result: r };
    if (r.orders) {
      clearFilters();
      setOrders(r.orders, r.pedidosFileName ?? 'pedidos');
      const snapshot = buildVDSnapshot(r.orders, r.corporate?.dataset ?? null);
      if (snapshot) {
        useFilterStore.setState({ cycle: [snapshot.ciclo] });
        addSnapshot(snapshot);
      }
    }
    if (r.corporate) {
      setCorporateDataset(r.corporate.dataset);
    }
    setPhase(r.orders && r.orders.length > 0 ? 'done' : 'error');
  }

  useEffect(() => {
    // Só a primeira abertura do Modo VD (nada carregado ainda) busca o lote padrão e segue direto para a análise.
    if (files.length > 0 || useOrderStore.getState().orders.length > 0) return;
    let cancelled = false;
    setLoadingDefaults(true);
    Promise.all(
      DEFAULT_FILE_NAMES.map(name =>
        fetch(`/dados-padrao-vd/${encodeURIComponent(name)}`)
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
      setPhase('loading');
      const r = await parseVDFiles(valid);
      if (cancelled || userInteractedRef.current) return;
      setResult(r);
      ultimoLote = { files: valid, result: r };
      if (r.orders) {
        clearFilters();
        setOrders(r.orders, r.pedidosFileName ?? 'pedidos');
        const snapshot = buildVDSnapshot(r.orders, r.corporate?.dataset ?? null);
        if (snapshot) {
          useFilterStore.setState({ cycle: [snapshot.ciclo] });
          addSnapshot(snapshot);
        }
      }
      if (r.corporate) setCorporateDataset(r.corporate.dataset);
      if (r.orders && r.orders.length > 0) {
        setPhase('done');
        onComplete();
      } else {
        setPhase('error');
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
    ultimoLote = null;
    setFiles([]);
    setResult(null);
    clearOrders();
    clearCorporateDataset();
    setPhase('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  const canProceed = !!result?.orders && result.orders.length > 0;
  // "14/2026" → "Ciclo 14 - 2026": o ciclo vem dos próprios pedidos, não fica fixo no código.
  const cicloImportado = result?.orders ? dominantCiclo(result.orders) : null;
  const cicloLabel = cicloImportado ? `Ciclo ${cicloImportado.replace('/', ' - ')}` : null;
  const detectedOptionalCount = result?.corporate ? Object.keys(result.corporate.detected).length : 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Importar dados{cicloLabel ? ` · ${cicloLabel}` : ''}
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>
        Importar planilhas do Modo VD
      </h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        Arraste o arquivo <strong>Consulta Pedidos</strong> (obrigatório) e, se tiver, os demais arquivos
        do lote — ranking de vendas, meta de sell-in e os relatórios da Extranet (receita, ruptura,
        base de revendedores). Todos os dados são processados localmente no navegador.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,.xls"
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
          border: `2px dashed ${drag ? 'var(--vd-ink, #1C1814)' : 'var(--vd-border-strong, #D8D0C0)'}`,
          borderRadius: 20, padding: 40,
          background: drag ? 'var(--vd-bg, #FAF7F2)' : 'var(--vd-surface, #FFFFFF)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 40, color: 'var(--vd-text-muted, #9B9287)', marginBottom: 10 }}>
          <i className={loadingDefaults || phase === 'loading' ? 'ph ph-spinner' : 'ph ph-cloud-arrow-up'} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {loadingDefaults ? 'Carregando dados padrão...' : phase === 'loading' ? 'Processando arquivos...' : 'Arraste os arquivos aqui'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--vd-text-secondary, #6B6258)' }}>
          ou <span style={{ color: 'var(--vd-ink, #1C1814)', fontWeight: 600, textDecoration: 'underline' }}>selecione do computador</span>
        </div>
      </div>

      <div style={{
        background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 14 }}>
          Obrigatório
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: result?.orders ? 'var(--vd-success-bg, #E0F2E8)' : 'var(--vd-bg-subtle, #F2EEE2)',
            color: result?.orders ? 'var(--vd-success, #2E7D5B)' : 'var(--vd-text-muted, #9B9287)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}>
            <i className={result?.orders ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Consulta Pedidos</div>
            {result?.orders && (
              <div style={{ fontSize: 11, color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace' }}>
                {result.pedidosFileName} · {result.orders.length.toLocaleString('pt-BR')} pedidos
                {result.pedidosResult && result.pedidosResult.fvcCount > 0 && ` (${result.pedidosResult.fvcCount.toLocaleString('pt-BR')} FVC incluídos)`}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--vd-surface, #FFFFFF)', border: '1px solid var(--vd-border, #E8E2D6)', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)', marginBottom: 14 }}>
          Opcionais ({detectedOptionalCount}/{OPTIONAL_FILES.length} detectados)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {OPTIONAL_FILES.map(f => {
            const det = result?.corporate?.detected[f];
            return (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: det ? 'var(--vd-success-bg, #E0F2E8)' : 'var(--vd-bg-subtle, #F2EEE2)',
                  color: det ? 'var(--vd-success, #2E7D5B)' : 'var(--vd-text-muted, #9B9287)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                }}>
                  <i className={det ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{VD_CORPORATE_FILE_LABELS[f]}</div>
                  {det && (
                    <div style={{ fontSize: 10, color: 'var(--vd-text-muted, #9B9287)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {det.rowCount} linhas
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {result && (result.errors.length > 0 || result.rankingErrors.length > 0) && (
        <div style={{ background: 'var(--vd-warning-bg, #FBF3D0)', border: '1px solid var(--vd-warning-border, #E8C547)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--vd-warning-text, #5C4500)', marginBottom: 6 }}>
            {result.errors.length + result.rankingErrors.length} aviso(s)
          </div>
          {[...result.errors, ...result.rankingErrors].slice(0, 6).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--vd-warning-text, #5C4500)', fontFamily: 'JetBrains Mono, monospace' }}>{e}</div>
          ))}
        </div>
      )}

      {canProceed && (
        <div style={{ background: 'var(--vd-success-bg, #E0F2E8)', border: '1px solid var(--vd-success-bg-strong, #9FD4B8)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-bold ph-check-circle" style={{ color: 'var(--vd-success, #2E7D5B)', fontSize: 18 }} />
          <div style={{ fontSize: 13, color: 'var(--vd-success-text-strong, #0E3A2A)' }}>
            Pedidos importados. {detectedOptionalCount > 0 ? `${detectedOptionalCount} relatório(s) corporativo(s) também disponíveis.` : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button variant="ghost" size="lg" onClick={handleClear}>Limpar</Button>
        <Button variant="primary" size="lg" disabled={!canProceed} onClick={onComplete}>
          Ver análise
        </Button>
      </div>
    </div>
  );
};

export default ImportScreen;
