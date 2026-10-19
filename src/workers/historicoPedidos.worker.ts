/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import { mapRow } from '../parsers/spreadsheetParser';
import { resumirCiclo, ResumoCiclo, janelaAnterior, ultimoCicloPorAno, SEGMENTOS_INATIVIDADE } from '../analytics/vdInatividade';

/**
 * Lê os ConsultaPedidos de ciclos anteriores fora da thread da tela — cada arquivo leva ~1,5 s pra
 * abrir, e com 13 ciclos a tela travava por quase meio minuto. Só os 6 ciclos antes do atual entram
 * na inatividade (I1–I6); os outros são espiados (2 linhas, pra saber o ciclo) e ficam de fora.
 */

export interface HistoricoRequest {
  files: File[];
  cicloAtual: string;
}

export type HistoricoMessage =
  | { tipo: 'progresso'; feitos: number; total: number }
  | { tipo: 'pronto'; ciclos: ResumoCiclo[]; foraDaJanela: string[]; erros: string[] };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function primeiraAba(wb: XLSX.WorkBook): XLSX.WorkSheet {
  return wb.Sheets[wb.SheetNames[0]];
}

ctx.onmessage = async (e: MessageEvent<HistoricoRequest>) => {
  const { files, cicloAtual } = e.data;
  const erros: string[] = [];

  // 1) Espia o ciclo de cada arquivo.
  const espiados: { file: File; buffer: ArrayBuffer; ciclo: string }[] = [];
  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', sheetRows: 2 });
      const linha = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeiraAba(wb), { defval: '' })[0];
      const ciclo = linha ? mapRow(linha).CicloMarketing : '';
      if (!ciclo) erros.push(`${file.name}: não parece um ConsultaPedidos (sem a coluna Ciclo Marketing).`);
      else espiados.push({ file, buffer, ciclo });
    } catch (err) {
      erros.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2) Lê por inteiro só os da janela de inatividade.
  const ultimoPorAno = ultimoCicloPorAno([cicloAtual, ...espiados.map(x => x.ciclo)]);
  const janela = new Set(janelaAnterior(cicloAtual, SEGMENTOS_INATIVIDADE.length, ultimoPorAno).filter(Boolean));
  const naJanela = espiados.filter(x => janela.has(x.ciclo));
  const foraDaJanela = espiados.filter(x => !janela.has(x.ciclo)).map(x => `${x.file.name} (${x.ciclo})`);

  const porCiclo = new Map<string, ResumoCiclo>();
  let feitos = 0;
  ctx.postMessage({ tipo: 'progresso', feitos, total: naJanela.length } satisfies HistoricoMessage);
  for (const { file, buffer, ciclo } of naJanela) {
    try {
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(primeiraAba(wb), { defval: '', raw: true });
      const resumo = resumirCiclo(linhas.map(mapRow), file.name);
      const anterior = porCiclo.get(ciclo);
      if (anterior) erros.push(`${file.name} e ${anterior.arquivo} são os dois do ciclo ${ciclo} — ficou o que tem mais pedidos.`);
      if (!anterior || resumo.pedidos > anterior.pedidos) porCiclo.set(ciclo, resumo);
    } catch (err) {
      erros.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
    feitos++;
    ctx.postMessage({ tipo: 'progresso', feitos, total: naJanela.length } satisfies HistoricoMessage);
  }

  ctx.postMessage({ tipo: 'pronto', ciclos: [...porCiclo.values()], foraDaJanela, erros } satisfies HistoricoMessage);
};
