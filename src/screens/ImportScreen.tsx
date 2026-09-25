import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import { parseVDFiles, VDImportResult } from '../parsers/vdImport';
import { useOrderStore } from '../store/useOrderStore';
import { useVDCorporateStore } from '../store/useVDCorporateStore';
import { useVDHistoryStore } from '../store/useVDHistoryStore';
import { useFilterStore } from '../store/useFilterStore';
import { VDCorporateFile, VD_CORPORATE_FILE_LABELS } from '../types/vdCorporate';
import { buildVDSnapshot } from '../analytics/vdSnapshot';

interface ImportScreenProps {
  onComplete: () => void;
}

type Phase = 'idle' | 'loading' | 'done' | 'error';

const OPTIONAL_FILES: VDCorporateFile[] = [
  'rankingVendas',
  'sellInMeta',
  'sellInDetalheSku',
  'receitaCanalVDPdv',
  'receitaCanalVDUn',
  'receitaCanalVDPeriodo',
  'receitaPeriodo',
  'receitaCanalUn',
  'receitaCategoria',
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
];

const DEFAULT_FILE_NAMES = [
  'ConsultaPedidos.xlsx',
  'ConsultaRankingVendas.csv',
  '20260924_GestaoPedidos_Meta_Sell_In_Por_Ciclo_7817cad1b38c.csv',
  '20260924_GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo_f0a309c40f80.csv',
  '20260924_ReceitaCanalVD_Performance_por_PDV_d89fbdbc17ca.xlsx',
  '20260924_ReceitaCanalVD_por_UN_5fac385f854d.xlsx',
  '20260924_ReceitaCanalVD_por_Periodo_9bb0825f11b8.xlsx',
  '20260924_Receita_por_Periodo_3a471a55bd59.xlsx',
  '20260924_Receita_por_Canal_UN_7fc026a14b25.xlsx',
  '20260924_Receita_por_Cat_Sub_Mar_4ee40247a0da.xlsx',
  '20260924_RupturaVD_Ruptura_causa_franqueado_11909ad218c1.xlsx',
  '20260924_RupturaVD_Ruptura_detalhada_ciclo_915dc20c818e.xlsx',
  '20260924_RupturaVD_detalhamento_ruptura_por_item_b4dd7201b900.xlsx',
  '20260924_VendaDireta_Evolucao_da_base_4b40e714e356.xlsx',
  '20260924_VendaDireta_Monitoramento_base_PDV_Supervisor_deb808fe9d62.xlsx',
  '20260924_VendaDireta_penetracao_base_dfe479c1446f.xlsx',
  '20260924_VendaDireta_Penetracao_de_Ativos_Detalhada_cf5ad8ea90c7.xlsx',
  '20260924_VendaDireta_Ativas_por_tier_7b33cc14aeac.xlsx',
  '20260924_VendaDireta_Segmentacao_da_Base_7a7e878e8af1.xlsx',
  '20260924_VendaDireta_Detalhamento_de_Categorias_e_UN_no_Periodo_de_Ciclos_ada3d167a9a8.xlsx',
];

const ImportScreen: React.FC<ImportScreenProps> = ({ onComplete }) => {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<VDImportResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
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
    if (files.length > 0) return;
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
    setFiles([]);
    setResult(null);
    clearOrders();
    clearCorporateDataset();
    setPhase('idle');
    if (fileRef.current) fileRef.current.value = '';
  }

  const canProceed = !!result?.orders && result.orders.length > 0;
  const detectedOptionalCount = result?.corporate ? Object.keys(result.corporate.detected).length : 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--vd-text-secondary, #6B6258)' }}>
        Importar dados · Ciclo 13
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>
        Importar planilhas do Modo VD
      </h1>
      <p style={{ color: 'var(--vd-text-secondary, #6B6258)', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        Arraste o arquivo <strong>Consulta Pedidos</strong> (obrigatório) e, se tiver, os demais arquivos
        do lote — ranking de vendas, meta de sell-in e os relatórios de BI corporativo (receita, ruptura,
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
