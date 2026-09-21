# Arquitetura de dados do DataLens

Este documento descreve como o DataLens carrega, processa e cruza dados para alimentar cada
gráfico, KPI, ranking e tabela da aplicação. Cobre os dois modos existentes — **Modo VD** e
**Modo Loja** — que são aplicações independentes dentro do mesmo bundle, cada uma com seu próprio
pipeline de dados.

## 1. Visão geral da aplicação

`src/App.tsx` decide qual modo renderizar a partir de `useAppModeStore` (`src/store/useAppModeStore.ts`):

- `mode === null` → `ModeSelectScreen` (tela de escolha entre Modo VD e Modo Loja).
- `mode === 'loja'` → `PinGate` com hash `LOJA_PIN_HASH` protegendo `LojaApp`.
- `mode === 'vd'` (padrão) → `PinGate` com hash `VD_PIN_HASH` protegendo `VDApp`.

`PinGate` (`src/screens/PinGate.tsx`) compara o PIN digitado (via `sha256`, `src/utils/sha256.ts`)
contra o hash fixo no código e libera o acesso salvando um flag em `localStorage` (`storageKey`),
para não pedir o PIN de novo enquanto a sessão do navegador durar.

Cada modo é um app React independente (`src/apps/VDApp.tsx`, `src/apps/LojaApp.tsx`) com seu
próprio roteamento por `useState` (sem React Router), sidebar, top bar e tema — não compartilham
estado de dados entre si.

## 2. Modo VD — pipeline de dados

### 2.1 Origem e parsing

- Fonte: uma única planilha de pedidos (`.xlsx` ou `.csv`), no formato "Consulta de Pedidos
  Unificado". Ao abrir o Modo VD, `VDApp.tsx` tenta buscar automaticamente
  `public/ConsultaPedidos_Unificado.xlsx` via `fetch` e popular o estado se nenhum pedido já
  estiver carregado; se isso falhar, o usuário importa manualmente pela `ImportScreen.tsx`
  (`src/parsers/spreadsheetParser.ts` → `parseSpreadsheet`).
- `parseSpreadsheet` decide entre `parseXLSX` (biblioteca `xlsx`) e `parseCSV` (biblioteca
  `papaparse`) pela extensão do arquivo.
- `mapRow` usa `COLUMN_MAP` para normalizar nomes de coluna variáveis (com/sem acento, com/sem
  espaço) para os campos fixos da interface `Order` (`src/types/order.ts`), convertendo números
  (`parseNum`, formato `1.234,56` → `1234.56`) e datas (`parseDate`, serial Excel ou string,
  sempre normalizadas para `DD/MM/AAAA`).
- `Papel` é convertido em `tierId` via `papelToTierId` (`src/design-system/tierStyles.ts`), que
  casa o texto do papel (ex. "Ouro", "Diamante GB") contra `TIER_DEFINITIONS` — se não encontrar,
  cai em `'cf'` (Consumidor Final).
- Pedidos cuja `Estrutura` começa com `FVC` são excluídos (`isFVC`) e contados em
  `fvcExcludedCount`.

### 2.2 Estado global

- `useOrderStore` (`src/store/useOrderStore.ts`) guarda o array de `Order[]` resultante do parse,
  nome do arquivo e `dateRange` (calculado a partir de `DataCaptacao` de todos os pedidos).
- `useFilterStore` (`src/store/useFilterStore.ts`) guarda o `FilterState` atual (ciclo,
  supervisor, estrutura, cidade, UF, modelo comercial, meio de captação, situação comercial, tier,
  busca textual, intervalo de datas) — é o filtro global aplicado em praticamente todas as telas.

### 2.3 Filtro e cruzamento

`useFilteredOrders` (`src/hooks/useAnalytics.ts`) aplica, em memória, todos os filtros de
`useFilterStore` sobre `orders`, campo a campo (`AND` entre os diferentes filtros, `OR` dentro de
cada filtro multi-seleção). Esse array filtrado é a base de todo o restante do pipeline — nenhuma
tela lê `orders` bruto, sempre passam por este hook (exceto a `ComparacaoSemanalScreen`, que chama
com `{ ignoreDateAndCycle: true }` para poder comparar vários ciclos/semanas ao mesmo tempo).

A partir de `useFilteredOrders`, três funções de analytics cruzam os pedidos em métricas
consumíveis pela UI:

| Função | Arquivo | O que calcula |
|---|---|---|
| `calcFinancialMetrics` | `src/analytics/financialMetrics.ts` | Receita bruta/líquida, ticket médio, pedidos finalizados/cancelados, revendedores ativos, e quebras por tier, ciclo, supervisor, revendedor, modelo comercial, meio de captação, dia do ciclo (`revenueByDayAndTier`, usado no calendário de picos) |
| `calcOperationalMetrics` | `src/analytics/operationalMetrics.ts` | SLA (minutos entre `DataAprovacao` e `DataAutorizacaoFaturamento`), pedidos atrasados (SLA > 24h), distribuição por status/detalhe, SLA médio por usuário, buckets de distribuição de SLA |
| `calcCommercialMetrics` | `src/analytics/commercialMetrics.ts` | Taxa de cancelamento, frequência de recompra, distribuição de revendedores por tier, top 10 revendedores por receita |

Um pedido é considerado elegível para receita (`isRevenueEligible`, em `financialMetrics.ts`)
quando `SituacaoComercial !== 'Cancelado'` e `DetalheSituacaoComercial !== 'Cancelado Pelo
Usuário'` — essa regra é reutilizada em várias telas para não contar pedidos cancelados como
receita.

`generateInsights` (`src/analytics/insightsEngine.ts`) cruza os três resultados acima (financeiro
+ operacional + comercial) para gerar frases automáticas (até 8) sobre o período filtrado — top
supervisor, ciclo mais rentável, modelo comercial dominante, taxa de cancelamento, usuário com
maior SLA, tier líder, revendedores ativos, tier com mais cancelamentos.

`useTierMetrics` recalcula, por tier, quantidade de pedidos, revendedores únicos, receita total e
ticket médio — usado nos cards de tier da tela inicial.

### 2.4 Telas e visualizações — Modo VD

| Tela (arquivo) | Fonte de dados | Cruzamento aplicado | Visualizações alimentadas |
|---|---|---|---|
| `TiersScreen.tsx` | `useFinancialMetrics`, `useTierMetrics`, `useFilteredOrders` | Agrega receita por supervisor localmente a partir dos pedidos filtrados | `KpiCard` (receita total, pedidos, ticket médio, revendedores ativos), `TierStatCard` por tier, `RankingChart` (receita por tier, receita por supervisor), `TrendLineChart` (receita por ciclo) |
| `DetailScreen.tsx` | `useFilteredOrders`, `useTierMetrics` | Filtra pedidos do tier selecionado e ranqueia revendedores | `RankingChart` com `DetailView` (drill-down de revendedores dentro do tier clicado) |
| `DashboardScreen.tsx` | `useFinancialMetrics`, `useOperationalMetrics`, `useCommercialMetrics`, `useInsights` | Consome os três blocos de métricas já cruzados + insights automáticos | `KpiCard`s, `TrendLineChart` (receita por ciclo), `TierDonutChart` (status dos pedidos), `ChartCard`/`RankingChart` (top supervisores, modelo comercial, meio de captação), lista de insights, distribuição de ANS/SLA |
| `DistribuicaoScreen.tsx` | `useFinancialMetrics` | Quebra por tier a partir de `financial.revenueByTier`/`ordersByTier` | `KpiCard`s, `RankingChart`, `DailyCycleChart` (receita diária por tier ao longo do ciclo, com top revendedores do dia via `topResellersByDay`) |
| `SupervisorScreen.tsx` | `useFilteredOrders` | Agrega por `ResponsavelEstrutura`/`CodEstrutura`, calcula SLA por estrutura localmente | `RankingChart` (ranking de supervisores/estruturas) |
| `TableScreen.tsx` | `useFilteredOrders` | Nenhum cruzamento adicional — exibe pedido a pedido | Tabela paginada/filtrável de pedidos, com `FilterBuilder` para refinar `useFilterStore` |
| `ComparacaoSemanalScreen.tsx` | `useFilteredOrders({ ignoreDateAndCycle: true })` | Agrupa pedidos por semana do calendário (a partir de `DataCaptacao`) e calcula métricas por semana para permitir comparação semana a semana | Múltiplos `ChartCard`s: faturamento semanal, cancelamentos por semana, pico diário por semana, evolução semanal por métrica, tabela-resumo comparativa |
| `ImportScreen.tsx` | Upload manual do usuário | Chama `parseSpreadsheet` e popula `useOrderStore` | Tela de import, sem visualização própria |

Todos os gráficos de ranking/barra/pizza usam o componente genérico `RankingChart.tsx`
(`src/components/charts/RankingChart.tsx`), que internamente decide o estilo visual (barra
horizontal/vertical/empilhada, pizza/torta/doughnut, treemap/funil/radar/linha/nuvem) e delega a
lista para `RankingList.tsx`. As cores de tier vêm de `TIER_STYLES`
(`src/design-system/tierStyles.ts`), e as cores de supervisor de
`src/design-system/supervisorColors.ts`.

## 3. Modo Loja — pipeline de dados

### 3.1 Origem e autoload

O Modo Loja consome até 26 arquivos: 7 CSVs obrigatórios de quebra (`CANAL`, `CONSULTOR`, `DATA`,
`FORMA`, `GESTAO`, `LOJAS`, `OPERADOR`) + 19 arquivos opcionais (Curva ABC, Venda por Hora, 7
arquivos de Gestão de Pedidos, 3 da família Receita por Canal/UN, e 7 xlsx de indicadores —
Resumo de Performance, Receita por Categoria, Serviços, Fidelidade, Loja Digital, Cuidados
Faciais, e os 2 de adesão à plataforma logística). Ao entrar em `LojaImportScreen.tsx`, se nenhum
arquivo já tiver sido carregado manualmente, um `useEffect` busca automaticamente todos os nomes
listados em `DEFAULT_FILE_NAMES` dentro de `public/dados-padrao-loja/` via `fetch`
(`encodeURIComponent` no nome, já que alguns arquivos trazem acento ou parênteses no nome de
origem), monta objetos `File` e chama `parseLojaFiles` — ou seja, o dataset padrão é populado sem
ação do usuário, exceto se ele interagir manualmente com o import (o que cancela o autoload via
`userInteractedRef`).

### 3.2 Parsing

`parseLojaFiles` (`src/parsers/lojaParser.ts`) processa cada arquivo recebido:

- **CSVs de dimensão obrigatória** (`GerencialVendas-*CANAL/CONSULTOR/DATA/FORMA/GESTAO/LOJAS/
  OPERADOR.csv`): detectados por nome do arquivo (`FILENAME_HINTS`) ou, em último caso, pelo
  cabeçalho da 2ª coluna (`HEADER_HINTS`, ex. "QUEBRAR POR LOJAS"). Cada linha é convertida em um
  `LojaMetricRow` (`rowsToLojaMetrics`), com a 1ª coluna sendo sempre a loja (código + nome, via
  `splitCodeName`) e a 2ª coluna a "quebra" específica da dimensão (ex. nome do consultor, forma de
  pagamento). As colunas de índice fixo 2–25 mapeiam GMV, boleto médio, qtd. boletos, receita
  líquida, descontos, trocas, penetração Fidelidade, etc. Em `CONSULTOR`/`OPERADOR`, a 2ª coluna
  chega como `"135 - KEMILLY RAFAELLY SOUZA SILVA"` (código interno + nome) — `splitCodeName` já
  separa isso em `quebraCodigo`/`quebraNome`, então o resto do app (inclusive o cruzamento por nome
  com os xlsx de indicadores) sempre trabalha com o nome já limpo, sem prefixo numérico.
- **CSVs opcionais** (curva ABC, venda por hora, 5 arquivos de Gestão de Pedidos): detectados por
  substring no nome normalizado (`detectOptionalCsv`) e parseados por funções dedicadas
  (`rowsToAbc`, `rowsToVendaHora`, `rowsToPedidosVisaoGeral`, `rowsToPedidosGiroCanal`,
  `rowsToPedidosHistorico`, `rowsToPedidosDetalhamentoSku`, `rowsToPedidosMetaSellIn`), que
  localizam colunas pelo cabeçalho (`findCol`, tolerante a variações de nome, inclusive o typo real
  de origem "% ATINGIMNETO DA META") em vez de índice fixo. A detecção do arquivo de sell-in por
  SKU precisa vir antes da de meta de sell-in em `OPTIONAL_CSV_FILENAME_HINTS`, porque o nome do
  primeiro também contém a substring do segundo.
- **XLSX opcionais** (Resumo de Performance, Receita por Categoria/Sub/Marca, Serviços em Loja,
  Programa Fidelidade, Loja Digital, Cuidados Faciais, a família `ReceitaCanalLoja_*` e os 2 de
  adesão à plataforma logística): detectados por substring no nome (`detectOptionalXlsx`) e
  parseados em `src/parsers/lojaXlsxParser.ts`, um parser dedicado por arquivo, cada aba do
  workbook tratada separadamente (ex. Resumo de Performance tem aba "CP" — indicador por indicador
  — e abas "PDV"/"CONSULTOR" — uma linha por entidade).
  - `receitaCanal`/`receitaCategoria` (campos legados, `Receita_por_Canal_UN.xlsx` /
    `Receita_por_Cat_Sub_Mar.xlsx`) continuam suportados para exports antigos, mas os lotes
    recebidos a partir de set/2026 não trazem mais esses arquivos — no lugar veio a família
    `ReceitaCanalLoja_*` (ver abaixo), com layout totalmente diferente.
  - `ReceitaCanalLoja_Performance_por_PDV.xlsx` → `receitaCanalLojaPdv`: uma linha por PDV, com 3
    blocos de 6 colunas cada (Loja / Clique e Retire / Total), localizados por busca exata dentro
    dos limites do bloco — necessário porque "GAP ACORDADO (R$)" e "GAP ACORDADO (%)" colidem por
    substring se comparados na ordem errada.
  - `ReceitaCanalLoja_por_UN.xlsx` → `receitaCanalLojaUn`: estrutura em blocos empilhados
    verticalmente (não em colunas) — total do CP, um bloco por UN, e a composição Loja x Clique e
    Retire ao final.
  - `ReceitaCanalLoja_por_Periodo.xlsx` → `receitaCanalLojaPeriodo`: nos lotes recebidos até agora
    chega só com a aba `FILTROS`, sem tabela de dados — o parser trata isso como lista vazia, não
    como erro.
  - `GestaoPedidos_usage-by-usage-category-adherence*.xlsx` → `logisticaAdesaoResumo` e
    `GestaoPedidos_Visão_detalhada_da_utilização_por_pedido*.xlsx` → `logisticaAdesaoDetalhe`:
    adesão à plataforma logística de transferência entre lojas ("Colabore"), resumo por categoria
    (4 linhas) e detalhe pedido a pedido (~2000 linhas/ciclo) respectivamente.
- Curva ABC e venda por hora são lidos em `iso-8859-1` (Latin-1); os demais em UTF-8 (os CSVs de
  Gestão de Pedidos, inclusive os 2 novos de sell-in por SKU, sem BOM; os `GerencialVendas-*` com
  BOM) — refletindo o encoding real dos exports do sistema de origem.
- Se alguma das 7 dimensões obrigatórias não for encontrada entre os arquivos, `parseLojaFiles`
  retorna `dataset: null` e lista o que falta em `errors`; os arquivos opcionais nunca bloqueiam a
  montagem do dataset.

O resultado é um `LojaDataset` (`src/types/loja.ts`) com uma lista de `LojaMetricRow[]` por
dimensão obrigatória (`lojas`, `forma`, `consultor`, `operador`, `data`, `canal`, `gestao`) mais os
campos opcionais tipados: `abc`, `vendaPorHora`, `pedidosVisaoGeral`, `pedidosGiroCanais`,
`pedidosHistorico`, `pedidosDetalhamentoSku`, `pedidosMetaSellIn`, `resumoPerformance`,
`receitaCanal`, `receitaCategoria`, `receitaCanalLojaPdv`, `receitaCanalLojaUn`,
`receitaCanalLojaPeriodo`, `servicos`, `fidelidade`, `lojaDigital`, `cuidadosFaciais`,
`logisticaAdesaoResumo`, `logisticaAdesaoDetalhe`.

### 3.3 Estado global

`useLojaStore` (`src/store/useLojaStore.ts`) guarda apenas `dataset: LojaDataset | null` e
`setDataset`/`clearDataset`. Diferente do Modo VD, o Modo Loja não tem um store de filtros global
central — cada tela implementa seus próprios filtros locais (ex. seletor de loja, aba de
consultor/operador) via `useState`.

### 3.4 Camada de cruzamento (`src/analytics/lojaMetrics.ts`)

Esta é a camada que efetivamente cruza os diferentes arquivos entre si. Principais funções:

- **`aggregateByName`** — agrega `LojaMetricRow[]` de uma dimensão (canal, forma, categoria/gestão)
  pelo nome da quebra, somando GMV, boletos, receita líquida, descontos, trocas, e calculando
  ticket médio, % de desconto, % de participação no total e penetração Fidelidade ponderada por
  boletos. É a base dos rankings de Canais, Formas e Categorias.
- **`rankLojas`** — ranking de lojas a partir do CSV `lojas`, usando o **código do PDV** como
  chave (não o nome, já que a mesma razão social se repete em lojas físicas diferentes); resolve o
  nome de exibição via `resolveLojaNome` (apelidos manuais em `lojaStoreAliases.ts`) e corrige o
  typo conhecido "COMETICOS" → "COSMETICOS" (`normalizeStoreDisplayName`).
- **`aggregateConsultoresPorLoja`** — agrega consultor/operador por nome mantendo a quebra por
  loja, para identificar a loja "principal" de cada pessoa e detectar quem vendeu em mais de uma
  unidade.
- **`computeOverallKPIs`** — soma GMV, receita líquida, boletos, descontos, trocas e penetração
  Fidelidade de toda a rede a partir do CSV `lojas` — alimenta os KPIs do topo da Visão Geral.
- **`findByPersonName`** / **`normalizePersonName`** — cruzamento por nome de pessoa entre CSVs
  (MAIÚSCULO) e os xlsx novos (capitalizados), com normalização de acento/caixa e fallback por
  distância de edição (Levenshtein, tolerância de até 2 caracteres) para tolerar pequenos erros de
  digitação entre exportações diferentes do mesmo sistema.
- **`findConsultorExtras`** — dado um consultor, busca por nome nos 4 xlsx opcionais novos
  (Fidelidade, Loja Digital, Serviços, Cuidados Faciais), que não compartilham nenhum ID estável
  entre si, apenas o nome como veio de cada exportação — é o principal ponto de cruzamento entre
  os CSVs "clássicos" e os xlsx novos.
- **`dailySeries`** / **`dayOfWeekAverages`** — série temporal de GMV/boletos a partir do CSV
  `data`, e média por dia da semana (a partir da data parseada).
- **`consistencyCheck`** — verifica se a soma de GMV bate entre as dimensões `lojas`, `canal`,
  `gestao` e `forma` (todas deveriam somar o mesmo total, vindo do mesmo pedido de origem, só que
  quebrado diferente) — usado como selo de confiança dos dados importados.
- **`crossInsights`** — gera frases automáticas cruzando várias dimensões e os xlsx opcionais:
  canal líder, forma de pagamento líder, categoria líder, gap entre 1º e 2º lugar no ranking de
  lojas, anomalias de desconto > 100% da receita, funil Fidelidade (% cliente cadastrado vs. % que
  completa o desafio), loja líder em Botik/Cuidados Faciais cruzada com sua posição no ranking
  geral de GMV, pior conversão de Loja Digital vs. média da rede, loja com maior GMV em Serviços.
- **`classifyAbc`** / **`classifyAbcByLoja`** — classificação ABC por faturamento acumulado (A até
  80%, B até 95%, C o resto), com heurística de item não-comercial (sacolas, amostras, preço
  unitário < R$3, sufixo "PRM") sobreponível por override manual do usuário
  (`useAbcOverridesStore.ts`, persistido em `localStorage`).
- **`hourlyDistribution`** — agrega venda por hora, calculando participação % de cada faixa
  horária na receita líquida total.
- **`pedidosRates`** — cruza o histórico de colocação de pedidos linha a linha, agrupando por loja
  ou por categoria, calculando taxa de colocação (colocado/sugerido) e taxa de atendimento
  (faturado/colocado) do fornecedor.
- **`sellInSkuRanking`** — a partir de `pedidosDetalhamentoSku`, agrega por SKU (somando entre PDVs
  e recalculando o atingimento a partir dos totais, não da média dos percentuais linha a linha) e
  ordena do pior para o melhor atingimento da meta de sell-in.
- **`logisticaAdesaoResumoPorPdv`** — a partir de `logisticaAdesaoDetalhe`, reagrupa os pedidos
  individuais por PDV (loja de destino) e calcula % "Usa Bem", % dentro do prazo e SLA médio de
  entrega (dias úteis) por loja — quebra que o arquivo-resumo sozinho não tem.
- **`optionalConsistencyWarnings`** — valida consistência entre pares de arquivos opcionais (ex.
  faturamento total da curva ABC vs. receita líquida de venda por hora; totais do histórico de
  colocação vs. o consolidado da Visão Geral do Ciclo; total de `pedidosDetalhamentoSku` vs.
  `pedidosMetaSellIn`; contagem por categoria de `logisticaAdesaoResumo` vs. `logisticaAdesaoDetalhe`),
  sinalizando divergência acima de 1% (ou contagem diferente, no caso da logística).

### 3.5 Telas e visualizações — Modo Loja

| Tela (arquivo) | Fonte de dados (`LojaDataset`) | Cruzamento aplicado | Visualizações alimentadas |
|---|---|---|---|
| `LojaOverviewScreen.tsx` | `dataset.lojas` | `computeOverallKPIs`, `rankLojas` | `KpiCard`s (GMV, receita líquida, ticket médio, penetração Fidelidade), `RankingChart` com `DetailView` (ranking de lojas com drill-down) |
| `LojaConsultoresScreen.tsx` | `dataset.consultor`, `dataset.operador` | `aggregateConsultoresPorLoja`, `listLojasInDimension` (filtro por loja), `findConsultorExtras` (cruza com Fidelidade/Loja Digital/Serviços/Cuidados Faciais) | `ChartCard`s com ranking de consultores/operadores e `ConsultorDetailPanel` (painel de detalhe cruzando os 4 xlsx opcionais por pessoa) |
| `LojaCanaisFormasScreen.tsx` | `dataset.canal`, `dataset.forma`, `dataset.receitaCanal` (legado), `dataset.receitaCanalLojaUn`/`receitaCanalLojaPdv` | `aggregateByName`, filtro opcional por loja via `listLojasInDimension` | Dois `RankingChart` lado a lado (canal de venda/ativação, formas de pagamento) + seção "Canal de cumprimento do pedido — Loja x Clique e Retire" (composição + ranking de PDV por % da meta) — rótulos explícitos para não confundir os dois sentidos de "canal" (ver §3.6) |
| `LojaCategoriasScreen.tsx` | `dataset.gestao`, `dataset.receitaCategoria` (xlsx legado) | `aggregateByName` sobre `gestao`; ranking direto das abas categoria/subcategoria/linha/marca do xlsx de Receita por Categoria | `RankingChart` (categorias via CSV de gestão) + `RankingChart`s adicionais para subcategoria/linha/marca quando o xlsx opcional está presente |
| `LojaPeriodoScreen.tsx` | `dataset.data` | `dailySeries`, `dayOfWeekAverages` | `SimpleLineChart` (série diária de GMV) e `RankingChart` (média de GMV por dia da semana) |
| `LojaAbcScreen.tsx` | `dataset.abc` (opcional) | `classifyAbc`, `classifyAbcByLoja`, overrides de `useAbcOverridesStore` | `RankingChart` da curva ABC (classes A/B/C), com toggle comercial/não-comercial e exportação CSV |
| `LojaPedidosScreen.tsx` | `dataset.pedidosHistorico`, `dataset.pedidosVisaoGeral`, `dataset.pedidosGiroCanais`, `dataset.pedidosDetalhamentoSku`, `dataset.pedidosMetaSellIn`, `dataset.logisticaAdesaoResumo`, `dataset.logisticaAdesaoDetalhe` (todos opcionais) | `pedidosRates` (por loja e por categoria), `buildLojaNomeLookup`, `sellInSkuRanking`, `logisticaAdesaoResumoPorPdv` | `RankingChart`s de taxa de colocação/atendimento por loja e por categoria, ranking de SKUs abaixo da meta de sell-in, e painel de adesão à plataforma logística por PDV (com fallback para o resumo por categoria quando só o resumo estiver presente) |
| `LojaHorarioScreen.tsx` | `dataset.vendaPorHora` (opcional) | `hourlyDistribution` | `RankingChart` de receita/boletos por faixa horária |
| `LojaFidelidadeServicosScreen.tsx` | `dataset.fidelidade`, `dataset.lojaDigital`, `dataset.servicos`, `dataset.cuidadosFaciais` (todos opcionais) | `aggregateConsultoresPorLoja` para contexto de loja, `findByPersonName` para cruzar pessoa entre arquivos | Quatro `RankingChart`s independentes: penetração Fidelidade, funil Loja Digital, Serviços por PDV, receita Cuidados Faciais/Botik — cada um com `getBreakdown` próprio |
| `LojaImportScreen.tsx` | Upload manual ou autoload de `public/dados-padrao-loja/` | Chama `parseLojaFiles` e popula `useLojaStore` | Tela de import com checklist de arquivos detectados/faltando por dimensão |

### 3.6 Termo ambíguo entre arquivos: "canal"

O nome "canal" aparece em dois lugares com significados diferentes, herdados do sistema de origem:

| Termo | Em `GerencialVendas-*CANAL.csv` / `dataset.canal` | Em `ReceitaCanalLoja_*.xlsx` / `dataset.receitaCanalLojaPdv`/`receitaCanalLojaUn` |
|---|---|---|
| **"Canal"** | Canal de **venda/ativação**: origem da venda dentro do PDV (`Loja`, `Whatsapp Oficial`, `Live Commerce`, `Parcerias`, `Skin/Make Experimentação`, `Venda Fora de Loja`, etc.) | Canal de **cumprimento** do pedido: só 2 valores, `Loja` (venda física) vs. `Clique e Retire` (compra online, retirada na loja) |

Os dois vivem em campos separados do `LojaDataset`, sem colisão de código — mas qualquer rótulo de
UI, tooltip ou insight automático que mencione "canal" precisa deixar explícito qual dos dois é
(ver rótulos em `LojaCanaisFormasScreen.tsx`). O mesmo vale para "pessoa": `dataset.consultor`
(quem recebe o crédito comercial da venda) e `dataset.operador` (quem processou o boleto no caixa)
são dimensões distintas — a mesma pessoa pode aparecer em ambas, mas as listas não são idênticas.

## 4. Componentes de visualização compartilhados

| Componente | Arquivo | Uso |
|---|---|---|
| `KpiCard` | `src/components/ui/KpiCard.tsx` | Cartão numérico de indicador único, usado em quase toda tela de ambos os modos |
| `ChartCard` | `src/components/charts/ChartCard.tsx` | Container padrão (título, subtítulo, hint) que envolve qualquer gráfico |
| `RankingChart` | `src/components/charts/RankingChart.tsx` | Componente principal de visualização — alterna entre barra (horizontal/vertical/empilhada), pizza/torta/doughnut, treemap, funil, radar, linha e nuvem, todos a partir da mesma lista de `RankingItem[]`; suporta `DetailView` (drill-down) e `getBreakdown` (detalhamento inline por item) |
| `RankingList` | `src/components/charts/RankingList.tsx` | Lista tabular usada como base visual pelo `RankingChart` e resolvedor de cores (`resolveItemColor`) |
| `TierDonutChart` | `src/components/charts/TierDonutChart.tsx` | Donut SVG customizado, usado no Dashboard VD para status de pedidos |
| `TrendLineChart` | `src/components/charts/TrendLineChart.tsx` | Linha de tendência SVG customizada, usada para receita por ciclo (VD) |
| `DailyCycleChart` | `src/components/charts/DailyCycleChart.tsx` | Calendário de receita diária por tier, com destaque de top revendedores do dia (Distribuição, VD) |
| `SimpleLineChart` | `src/components/loja/SimpleLineChart.tsx` | Linha simples usada na série diária de GMV (Período, Loja) |
| `ConsultorDetailPanel` | `src/components/loja/ConsultorDetailPanel.tsx` | Painel de detalhe de consultor no Modo Loja, cruzando os 4 xlsx opcionais via `findConsultorExtras` |
| `TierStatCard` / `TierAmbience` / `TierBadge` | `src/components/TierStatCard.tsx`, `src/components/TierAmbience.tsx`, `src/components/ui/TierBadge.tsx` | Identidade visual por tier (cores/gradientes de `TIER_STYLES`), exclusivos do Modo VD |

## 5. Observações gerais sobre o cruzamento de dados

- Nos dois modos, o cruzamento acontece inteiramente no cliente (React), em memória, a partir dos
  arquivos já parseados — não há backend nem banco de dados envolvido.
- No Modo VD, o "cruzamento" é majoritariamente agregação de um único dataset de pedidos por
  diferentes chaves (tier, supervisor, ciclo, dia, modelo comercial, meio de captação).
- No Modo Loja, o cruzamento é mais heterogêneo: além de agregações dentro de um mesmo arquivo,
  há cruzamento **entre arquivos diferentes** por chave textual — código de loja (mais confiável,
  usado como chave primária sempre que disponível) ou nome de pessoa normalizado (menos confiável,
  com fallback por distância de edição), já que os arquivos de origem não compartilham um ID
  técnico estável entre si.
- Verificações de consistência (`consistencyCheck`, `optionalConsistencyWarnings`) existem
  justamente porque os arquivos de origem são exports independentes do mesmo sistema, com
  possibilidade de desalinhamento de período entre eles — servem de sinal de confiança, não de
  correção automática dos dados.
- O Modo Loja tem duas famílias de arquivos que descrevem o mesmo fato em granularidades
  diferentes: sell-in (`pedidosMetaSellIn` → 1 linha por ciclo; `pedidosDetalhamentoSku` → 1 linha
  por PDV×SKU; `pedidosHistorico` → 1 linha por PDV×SKU×campanha) e adesão logística
  (`logisticaAdesaoResumo` → 4 linhas por categoria; `logisticaAdesaoDetalhe` → 1 linha por
  pedido). As telas calculam a partir do arquivo mais granular disponível (mais flexível para
  drill-down/ranking) e usam o arquivo-resumo como checagem de consistência ou fallback quando o
  granular não vier no upload.
- Nem todo arquivo "obrigatório no papel" chega de fato em todo lote — um lote anterior a este não
  trouxe `GerencialVendas-*LOJAS.csv`, por exemplo. O parser reporta com precisão, por nome de
  arquivo, o que falta (`errors`), em vez de assumir que "obrigatório" significa "sempre presente".
