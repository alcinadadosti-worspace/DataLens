import React, { useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import PageTitle from '../../components/ui/PageTitle';
import InfoHint from '../../components/ui/InfoHint';
import { parseLojaFiles } from '../../parsers/lojaParser';
import { useLojaStore } from '../../store/useLojaStore';
import { LOJA_DIMENSIONS, LOJA_DIMENSION_LABELS, LOJA_OPTIONAL_FILES, LOJA_OPTIONAL_FILE_LABELS, LojaParseResult } from '../../types/loja';

interface LojaImportScreenProps {
  onComplete: () => void;
}

const LojaImportScreen: React.FC<LojaImportScreenProps> = ({ onComplete }) => {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<LojaParseResult | null>(null);
  const [loading, setLoading] = useState(false);
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
      <p style={{ color: '#6B6258', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
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
          border: `2px dashed ${drag ? '#1C1814' : '#D8D0C0'}`,
          borderRadius: 20, padding: 40,
          background: drag ? '#FAF7F2' : 'white',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 40, color: '#9B9287', marginBottom: 10 }}>
          <i className={loading ? 'ph ph-spinner' : 'ph ph-cloud-arrow-up'} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {loading ? 'Processando arquivos...' : 'Arraste os arquivos aqui'}
        </div>
        <div style={{ fontSize: 13, color: '#6B6258' }}>
          ou <span style={{ color: '#1C1814', fontWeight: 600, textDecoration: 'underline' }}>selecione do computador</span>
        </div>
      </div>

      {/* Checklist */}
      <div style={{
        background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 14, display: 'flex', alignItems: 'center' }}>
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
                  background: det ? '#E0F2E8' : '#F2EEE2',
                  color: det ? '#2E7D5B' : '#9B9287',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>
                  <i className={det ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1814' }}>{LOJA_DIMENSION_LABELS[dim]}</div>
                  {det && (
                    <div style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        background: 'white', border: '1px solid #E8E2D6', borderRadius: 14,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258', marginBottom: 14, display: 'flex', alignItems: 'center' }}>
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
                  background: det ? '#E0F2E8' : '#F2EEE2',
                  color: det ? '#2E7D5B' : '#9B9287',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>
                  <i className={det ? 'ph-bold ph-check' : 'ph ph-circle-dashed'} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1814' }}>{LOJA_OPTIONAL_FILE_LABELS[f]}</div>
                  {det && (
                    <div style={{ fontSize: 11, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div style={{ background: '#FBF3D0', border: '1px solid #E8C547', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4500', marginBottom: 6 }}>
            {result.errors.length} aviso(s)
          </div>
          {result.errors.map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#5C4500', fontFamily: 'JetBrains Mono, monospace' }}>{e}</div>
          ))}
        </div>
      )}

      {canProceed && (
        <div style={{ background: '#E0F2E8', border: '1px solid #9FD4B8', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-bold ph-check-circle" style={{ color: '#2E7D5B', fontSize: 18 }} />
          <div style={{ fontSize: 13, color: '#0E3A2A' }}>
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
