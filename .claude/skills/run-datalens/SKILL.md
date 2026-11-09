---
name: run-datalens
description: Build, run, start, screenshot and drive the DataLens app (Modo VD and Modo Loja). Use when asked to run DataLens, open a screen, take a screenshot, check a screen after a change or a cycle swap, validate a data batch, or confirm the parsers read the spreadsheets.
---

DataLens é um app React + Vite que roda só no navegador e lê as planilhas de `public/dados-padrao-*`. O agente o
controla com `.claude/skills/run-datalens/driver.mjs`, que abre o Chromium headless, entra no modo, passa pelas telas e
tira capturas. Para mudanças só em parser, `parse-lote.ts` lê um lote sem navegador.

Todos os caminhos partem da raiz do repositório.

## Setup

`playwright-core` não é dependência do projeto. Instale sem alterar `package.json` nem o lockfile:

```bash
npm install
npm install --no-save --no-package-lock playwright-core@1.63.0
npx playwright-core install chromium
mkdir -p node_modules/.cache/run-datalens
```

Um `npm install` posterior remove o `playwright-core`; basta repetir a segunda linha.

## Build

```bash
npx tsc --noEmit
npx vite build
```

## Run (agent path)

Suba o servidor e espere a porta responder:

```bash
(npx vite --port 5173 --strictPort > node_modules/.cache/run-datalens/vite.log 2>&1 &)
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Passe por todas as telas de um modo ou só pelas que quiser, usando o rótulo do menu:

```bash
node .claude/skills/run-datalens/driver.mjs loja --all
node .claude/skills/run-datalens/driver.mjs vd --all
node .claude/skills/run-datalens/driver.mjs loja "Campanhas BSO" "Ruptura"
```

As capturas ficam em `node_modules/.cache/run-datalens/` (`<modo>_<rótulo>.png`); use `--out <pasta>` para mudar. Abra as
capturas: o driver só detecta erro de JavaScript, falha de navegação e rolagem horizontal, não layout quebrado. O código de
saída é 1 quando há erro.

Pare o servidor:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

## Validar um lote sem navegador

Use depois de trocar planilhas ou mexer em parser. Termina com código 1 se algum arquivo der erro:

```bash
npx esbuild .claude/skills/run-datalens/parse-lote.ts --bundle --platform=node --format=cjs --outfile=node_modules/.cache/run-datalens/parse-lote.cjs --log-level=warning
node --no-warnings node_modules/.cache/run-datalens/parse-lote.cjs loja public/dados-padrao-loja
node --no-warnings node_modules/.cache/run-datalens/parse-lote.cjs vd public/dados-padrao-vd
```

## Run (human path)

```bash
npm run dev
```

Abre em `http://localhost:5173` e pede o PIN de acesso e o do modo. Pare com Ctrl-C.

## Test

O projeto não tem suíte de testes. A verificação é `npx tsc --noEmit`, `npx vite build` e o driver.

## Gotchas

- **Há dois portões de PIN.** `LoginGate` vem antes da escolha de modo, e cada modo tem o seu. O driver grava no
  `localStorage` do navegador de teste os hashes que já estão em `src/App.tsx` e `src/screens/LoginGate.tsx`. Isso não altera
  PIN nem código do app.
- **A escolha de modo é por posição:** `.glossy-btn` 0 é VD e 1 é Loja.
- **O lote padrão carrega sozinho** e leva vários segundos. O driver espera o texto do cabeçalho; na VD espera mais 9 s,
  porque o histórico da Inatividade é lido em segundo plano.
- **Só os arquivos listados em `DEFAULT_FILE_NAMES` carregam no app.** A lista fica em `src/screens/ImportScreen.tsx` e
  `src/screens/loja/LojaImportScreen.tsx`. `parse-lote` lê a pasta inteira, então um arquivo fora da lista passa nele e não
  aparece na tela.
- **A largura mínima é de desktop.** Em 390 px o app estoura para 716 px; o driver usa 1440 × 900.
- **Meça a largura depois da transição.** Medições feitas cedo demais após trocar de tela não mostram estouro que aparece
  depois; o driver espera 1,5 s.
- **Um 404 no console é o favicon,** que o projeto não tem. O driver ignora.

## Troubleshooting

- **`page.goto: net::ERR_CONNECTION_REFUSED`:** o servidor não subiu. Rode o `mkdir -p` do Setup: sem a pasta do log, o
  redirecionamento falha e o Vite nem inicia.
- **Clique no modo expira:** o `LoginGate` está cobrindo a tela porque o hash não foi gravado. Confira se `PIN_HASH`,
  `LOJA_PIN_HASH` e `VD_PIN_HASH` ainda existem com esses nomes.
