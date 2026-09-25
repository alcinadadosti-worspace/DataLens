import Papa from 'papaparse';
import { RankingVendaRow, RankingVendaParseResult } from '../types/vdRanking';
import { toNum } from './vdNumberUtils';

/**
 * ~200 registros de ConsultaRankingVendas.csv (de 26 mil) vêm fisicamente partidos em 2-3 linhas do
 * arquivo: o campo NomeProduto de alguns SKUs contém uma quebra de linha literal, sem estar entre
 * aspas. Um registro lógico completo tem 16 `|` fora de aspas (17 campos); acumulamos linhas físicas
 * até bater essa contagem antes de tratar como um registro — ver LEITURA_PLANILHAS_VD.md §2.2.
 */
const FIELDS_PER_ROW = 17;
const PIPES_PER_ROW = FIELDS_PER_ROW - 1;

function countUnquotedPipes(s: string): number {
  let pipes = 0;
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === '|' && !inQuote) pipes++;
  }
  return pipes;
}

export function repairPipeLines(text: string): { records: string[]; repairedCount: number } {
  const withoutBom = text.replace(/^﻿/, '');
  const physicalLines = withoutBom.split(/\r\n|\n|\r/);
  const records: string[] = [];
  let buffer = '';
  let bufferLines = 0;
  let repairedCount = 0;

  for (const line of physicalLines) {
    if (line === '' && buffer === '') continue; // linha em branco solta, não faz parte de registro nenhum
    // Junta com espaço, não com '\n': o registro final vai para dentro de um blob único separado por
    // '\n' entre registros (records.join('\n')) — se sobrasse um '\n' bruto no meio do registro
    // reparado, o PapaParse quebraria nele de novo ao reparsear o blob, desfazendo o reparo.
    buffer = buffer.length ? buffer + ' ' + line : line;
    bufferLines++;
    if (countUnquotedPipes(buffer) >= PIPES_PER_ROW) {
      if (bufferLines > 1) repairedCount++;
      records.push(buffer);
      buffer = '';
      bufferLines = 0;
    }
  }
  if (buffer.trim()) records.push(buffer);

  return { records, repairedCount };
}

export async function parseRankingVendasCSV(file: File): Promise<RankingVendaParseResult> {
  const text = await file.text();
  const { records, repairedCount } = repairPipeLines(text);
  if (records.length === 0) {
    return { rows: [], errors: ['Arquivo vazio'], rowCount: 0, repairedCount: 0 };
  }

  const parsed = Papa.parse<Record<string, string>>(records.join('\n'), {
    header: true,
    delimiter: '|',
    quoteChar: '"',
    skipEmptyLines: true,
  });

  const errors = parsed.errors.map(e => `Linha ${e.row}: ${e.message}`);

  const rows: RankingVendaRow[] = parsed.data
    .filter(r => (r['CodigoRevendedora'] ?? '').trim() !== '')
    .map(r => ({
      gerencia: (r['Gerencia'] ?? '').trim(),
      setor: (r['Setor'] ?? '').trim(),
      codigoRevendedora: (r['CodigoRevendedora'] ?? '').trim(),
      nomeRevendedora: (r['NomeRevendedora'] ?? '').trim(),
      quantidadePontos: toNum(r['QuantidadePontos']),
      cicloCaptacao: (r['CicloCaptacao'] ?? '').trim(),
      cicloFaturamento: (r['CicloFaturamento'] ?? '').trim(),
      codigoProduto: (r['CodigoProduto'] ?? '').trim(),
      nomeProduto: (r['NomeProduto'] ?? '').trim().replace(/\s+/g, ' '),
      tipo: (r['Tipo'] ?? '').trim(),
      dataCaptacao: (r['DataCaptacao'] ?? '').trim(),
      quantidadeItens: toNum(r['QuantidadeItens']),
      faturamento: toNum(r['Faturamento']),
      valorPraticado: toNum(r['ValorPraticado']),
      valorVenda: toNum(r['ValorVenda']),
      meioCaptacao: (r['Meio Captacao'] ?? '').trim(),
      tipoEntrega: (r['Tipo Entrega'] ?? '').trim(),
    }));

  return { rows, errors, rowCount: rows.length, repairedCount };
}
