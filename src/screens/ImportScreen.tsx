import React, { useState, useRef } from 'react';
import Button from '../components/ui/Button';
import { parseSpreadsheet } from '../parsers/spreadsheetParser';
import { useOrderStore } from '../store/useOrderStore';
import { useFilterStore } from '../store/useFilterStore';

interface ImportScreenProps {
  onComplete: () => void;
}

type Phase = 'idle' | 'loading' | 'done' | 'error';

const ImportScreen: React.FC<ImportScreenProps> = ({ onComplete }) => {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rowCount, setRowCount] = useState(0);
  const [fvcExcluded, setFvcExcluded] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const setOrders = useOrderStore(s => s.setOrders);
  const clearOrders = useOrderStore(s => s.clearOrders);
  const clearFilters = useFilterStore(s => s.clearFilters);

  async function processFile(f: File) {
    setFile(f);
    setPhase('loading');
    setErrors([]);

    const result = await parseSpreadsheet(f);
    setRowCount(result.orders.length);
    setFvcExcluded(result.fvcExcludedCount);
    setColumns(result.detectedColumns.slice(0, 8));

    if (result.errors.length > 0 && result.orders.length === 0) {
      setErrors(result.errors);
      setPhase('error');
      return;
    }

    if (result.errors.length > 0) {
      setErrors(result.errors.slice(0, 5));
    }

    clearFilters();
    setOrders(result.orders, f.name);
    setPhase('done');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  function handleClick() {
    if (phase === 'idle' || phase === 'error') {
      fileRef.current?.click();
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B6258' }}>
        Importar dados
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 6px' }}>
        Importar planilha
      </h1>
      <p style={{ color: '#6B6258', fontSize: 15, marginTop: 0, marginBottom: 28 }}>
        Arraste seu arquivo{' '}
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>.xlsx</code> ou{' '}
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>.csv</code> abaixo.
        Todos os dados são processados localmente no navegador.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,.xls"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: `2px dashed ${drag ? '#1C1814' : '#D8D0C0'}`,
          borderRadius: 20, padding: 48,
          background: drag ? '#FAF7F2' : 'white',
          textAlign: 'center',
          cursor: phase === 'loading' ? 'default' : 'pointer',
          transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {phase === 'idle' && (
          <>
            <div style={{ fontSize: 48, color: '#9B9287', marginBottom: 12 }}>
              <i className="ph ph-cloud-arrow-up" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Arraste o arquivo aqui</div>
            <div style={{ fontSize: 13, color: '#6B6258' }}>
              ou <span style={{ color: '#1C1814', fontWeight: 600, textDecoration: 'underline' }}>selecione do computador</span>
            </div>
            <div style={{ fontSize: 11, color: '#9B9287', marginTop: 16, fontFamily: 'JetBrains Mono, monospace' }}>
              .xlsx · .csv · até 50 MB
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 36, color: '#9B9287' }}>
              <i className="ph ph-spinner" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Processando {file?.name}...</div>
            <div style={{ fontSize: 13, color: '#6B6258' }}>Analisando colunas e validando dados</div>
          </div>
        )}

        {phase === 'done' && file && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#E0F2E8', color: '#2E7D5B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <i className="ph ph-check-circle" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{file.name}</div>
              <div style={{ fontSize: 13, color: '#6B6258', marginTop: 4 }}>
                {rowCount.toLocaleString('pt-BR')} pedidos importados com sucesso
              </div>
              {fvcExcluded > 0 && (
                <div style={{ fontSize: 12, color: '#9B9287', marginTop: 4 }}>
                  <i className="ph ph-funnel" style={{ marginRight: 4 }} />
                  {fvcExcluded.toLocaleString('pt-BR')} pedidos FVC (terceirizados) excluídos automaticamente
                </div>
              )}
            </div>
            {errors.length > 0 && (
              <div style={{ background: '#FBF3D0', border: '1px solid #E8C547', borderRadius: 10, padding: '10px 14px', textAlign: 'left', width: '100%', maxWidth: 480 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4500', marginBottom: 6 }}>
                  {errors.length} aviso(s) durante importação
                </div>
                {errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#5C4500', fontFamily: 'JetBrains Mono, monospace' }}>{e}</div>
                ))}
              </div>
            )}
            {columns.length > 0 && (
              <div style={{ fontSize: 12, color: '#9B9287', fontFamily: 'JetBrains Mono, monospace' }}>
                Colunas: {columns.slice(0, 5).join(', ')}{columns.length > 5 ? ` +${columns.length - 5}` : ''}
              </div>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FBE5E9', color: '#B83A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <i className="ph ph-warning-circle" />
            </div>
            <div style={{ fontWeight: 600 }}>Erro ao processar arquivo</div>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: '#B83A3A', fontFamily: 'JetBrains Mono, monospace' }}>{e}</div>
            ))}
            <div style={{ fontSize: 13, color: '#6B6258' }}>Clique para tentar outro arquivo</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <Button variant="ghost" onClick={() => {
          clearOrders();
          setPhase('idle');
          setFile(null);
          setErrors([]);
          setColumns([]);
          setRowCount(0);
          setFvcExcluded(0);
          if (fileRef.current) fileRef.current.value = '';
        }}>
          Limpar
        </Button>
        <Button
          variant="primary"
          disabled={phase !== 'done'}
          onClick={onComplete}
        >
          {phase === 'loading' ? 'Processando...' : phase === 'done' ? 'Ver análise' : 'Analisar planilha'}
        </Button>
      </div>
    </div>
  );
};

export default ImportScreen;
