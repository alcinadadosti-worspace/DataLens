#!/usr/bin/env node
// Abre o DataLens num Chromium headless, entra num modo e passa pelas telas.
// Uso: node .claude/skills/run-datalens/driver.mjs <loja|vd> [--all] [--out <pasta>] ["Rótulo do menu" ...]
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const fonte = caminho => readFileSync(join(raiz, caminho), 'utf8');

const args = process.argv.slice(2);
const modo = args.shift();
if (modo !== 'loja' && modo !== 'vd') {
  console.error('Uso: driver.mjs <loja|vd> [--all] [--out <pasta>] ["Rótulo do menu" ...]');
  process.exit(2);
}
const opcao = nome => {
  const i = args.indexOf(nome);
  return i < 0 ? false : args.splice(i, 1).length > 0;
};
const todas = opcao('--all');
const iOut = args.indexOf('--out');
const saida = iOut >= 0 ? args.splice(iOut, 2)[1] : join(raiz, 'node_modules/.cache/run-datalens');
mkdirSync(saida, { recursive: true });

// Os menus e os hashes vêm do código, para o driver não envelhecer quando eles mudarem.
const rotulos = caminho => [...fonte(caminho).matchAll(/label:\s*'([^']+)'/g)].map(m => m[1]).filter(l => l !== 'Importar');
const rotas = todas ? rotulos(modo === 'loja' ? 'src/components/layout/LojaSidebar.tsx' : 'src/components/layout/Sidebar.tsx') : args;
const hash = (caminho, nome) => fonte(caminho).match(new RegExp(`${nome}\\s*=\\s*'([0-9a-f]{64})'`))?.[1];
const pins = {
  datalens_unlocked: hash('src/screens/LoginGate.tsx', 'PIN_HASH'),
  datalens_unlocked_loja: hash('src/App.tsx', 'LOJA_PIN_HASH'),
  datalens_unlocked_vd: hash('src/App.tsx', 'VD_PIN_HASH'),
};
if (Object.values(pins).some(v => !v)) throw new Error(`Hash de PIN não encontrado no código: ${JSON.stringify(pins)}`);

const navegador = await chromium.launch({ args: ['--no-sandbox'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
await contexto.addInitScript(p => Object.entries(p).forEach(([k, v]) => localStorage.setItem(k, v)), pins);
const pagina = await contexto.newPage();

const erros = [];
pagina.on('pageerror', e => erros.push(`PAGEERROR ${e.message.slice(0, 300)}`));
pagina.on('console', m => {
  // O projeto não tem favicon: esse 404 aparece em toda carga e não indica problema.
  if (m.type() === 'error' && !m.text().includes('404')) erros.push(m.text().slice(0, 220));
});

await pagina.goto(process.env.DATALENS_URL ?? 'http://localhost:5173');
await pagina.locator('.glossy-btn').nth(modo === 'loja' ? 1 : 0).click();
// O lote padrão carrega sozinho; este texto só aparece no cabeçalho depois dele.
await pagina.getByText(modo === 'loja' ? /importado em/ : /\d pedidos/).first().waitFor({ timeout: 60000 });
// Na VD o histórico da Inatividade segue lendo em segundo plano (~8 s).
if (modo === 'vd') await pagina.waitForTimeout(9000);
await pagina.screenshot({ path: join(saida, `${modo}_inicio.png`), fullPage: true });
console.log('carregou', modo, '→', join(saida, `${modo}_inicio.png`));

for (const rota of rotas) {
  const alvo = pagina.getByText(rota, { exact: true }).first();
  const clicou = await alvo.click({ timeout: 8000 }).then(() => true, e => {
    erros.push(`NAV ${rota}: ${e.message.slice(0, 120)}`);
    return false;
  });
  if (!clicou) continue;
  await pagina.waitForTimeout(1500);
  const arquivo = join(saida, `${modo}_${rota.replace(/[^\p{L}\p{N}]+/gu, '_')}.png`);
  await pagina.screenshot({ path: arquivo, fullPage: true });
  const [texto, largura, janela] = await pagina.evaluate(() => [document.body.innerText.length, document.documentElement.scrollWidth, innerWidth]);
  console.log(`${rota}: texto ${texto}, largura ${largura}/${janela}${largura > janela ? ' ROLAGEM HORIZONTAL' : ''}`);
}

console.log('ERROS', erros.length);
[...new Set(erros)].slice(0, 15).forEach(e => console.log(' ', e));
await navegador.close();
process.exit(erros.length ? 1 : 0);
