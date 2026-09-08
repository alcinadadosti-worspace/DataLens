import React, { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { parseLojaFiles } from '../../parsers/lojaParser';
import { useLojaStore } from '../../store/useLojaStore';
import { LOJA_DIMENSIONS, LOJA_DIMENSION_LABELS, LOJA_OPTIONAL_FILES, LOJA_OPTIONAL_FILE_LABELS, LojaParseResult } from '../../types/loja';

const DEFAULT_FILE_NAMES = [
  'GerencialVendas-01-09-2026CANAL.csv',
  'GerencialVendas-01-09-2026CONSULTOR.csv',
  'GerencialVendas-01-09-2026DATA.csv',
  'GerencialVendas-01-09-2026FORMA.csv',
  'GerencialVendas-01-09-2026GESTAO.csv',
  'GerencialVendas-01-09-2026LOJAS.csv',
  'GerencialVendas-01-09-2026OPERADOR.csv',
  'relatorioABCVenda.csv',
  'relatorioVendaPorHora.csv',
  '20260902_GestaoPedidos_Visao_Geral_por_Ciclo_0a4eefbbbfbe.csv',
  '20260902_GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo_178adeb05957.csv',
  '20260902_GestaoPedidos_Historico_Colocacao_Pedido_0a97308d4986.csv',
  '20260902_Receita_por_Canal_UN_047811f18f65.xlsx',
  '20260902_Receita_por_Cat_Sub_Mar_7edb29665699.xlsx',
  '20260904_Resumo_de_Performance_Indicadores_Loja_c7007cbcf310.xlsx',
  '20260904_Loja_cuidados_faciais_iaf_a288d7bf06ba.xlsx',
  '20260904_LojaDigital_Performance_por_Pdv_Consultor_a673a862600f.xlsx',
  '20260904_ProgramaFidelidade_Distribuicao_Penetracao_boleto_Fidelidade_8b55d0b32e4d.xlsx',
  '20260904_Servicos_em_loja_5b5eb7906d4e.xlsx',
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
        fetch(`/dados-padrao-loja/${name}`)
          .then(r => (r.ok ? r.blob() : null))
          .then(blob => (blob ? new File([blob], name, { type: blob.type }) : null))
          .catch(() => null)
      )
    ).then(async loaded => {
      if (cancelled) return;
      setLoadingDefaults(false);
      const valid = loaded.filter((f): f is File => f !== null);
      if (valid.length === 0) return;
      setFiles(valid);
      setLoading(true);
      const r = await parseLojaFiles(valid);
      if (cancelled) return;
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
