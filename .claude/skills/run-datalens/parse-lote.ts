// Lê um lote pelos parsers reais, sem navegador. Uso no SKILL.md (precisa ser empacotado com esbuild).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseLojaFiles } from '../../../src/parsers/lojaParser';
import { parseVDFiles } from '../../../src/parsers/vdImport';

const [modo, pasta] = process.argv.slice(2);
if ((modo !== 'loja' && modo !== 'vd') || !pasta) {
  console.error('Uso: parse-lote <loja|vd> <pasta>');
  process.exit(2);
}
const arquivos = readdirSync(pasta)
  .filter(nome => statSync(join(pasta, nome)).isFile())
  .map(nome => new File([readFileSync(join(pasta, nome))], nome));

(async () => {
  if (modo === 'loja') {
    const r = await parseLojaFiles(arquivos);
    console.log('dataset:', r.dataset ? 'ok' : 'NULO');
    console.log('obrigatórios:', Object.entries(r.detected).map(([k, v]) => `${k}=${(v as { rowCount: number }).rowCount}`).join(' '));
    console.log('opcionais:', Object.entries(r.detectedOptional).map(([k, v]) => `${k}=${(v as { rowCount: number }).rowCount}`).join(' '));
    console.log('bso:', r.dataset?.bso?.linhas.length ?? 0, 'linhas, R$', r.dataset?.bso?.linhas.reduce((s, l) => s + l.gerado, 0).toFixed(2));
    console.log('último dia de serviços:', r.dataset?.servicosDiario?.at(-1)?.dia);
    console.log(`erros (${r.errors.length}):`, ...r.errors.map(e => `\n  ${e.slice(0, 200)}`));
    process.exit(r.errors.length ? 1 : 0);
  }
  const r = await parseVDFiles(arquivos);
  console.log('pedidos:', r.orders?.length, 'ranking:', r.rankingVendas?.length);
  console.log('relatórios:', Object.keys(r.corporate?.detected ?? {}).length);
  console.log(`erros (${r.errors.length}):`, ...r.errors.map(e => `\n  ${e.slice(0, 200)}`));
  process.exit(r.errors.length ? 1 : 0);
})();
