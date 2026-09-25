# Leitura de Planilhas — Modo VD v2 (Camada de Dados Corporativos, Ciclo 13)

Este documento evolui o `LEITURA_PLANILHAS_VD.md` original. Aquele descrevia um modelo simples —
**1 arquivo → 1 dataset de `Order[]`**. O lote analisado aqui (18 arquivos, todos referentes ao
**Ciclo 13 - 2026** de uma franquia de perfumaria/cosméticos com dois PDVs: `13706` Palmeira dos
Índios e `13707` Penedo/AL) rompe esse modelo: são **três famílias de dados bem diferentes**, com
grãos, formatos e propósitos distintos, que precisam ser lidas, normalizadas e **cruzadas** entre
si — não apenas mapeadas linha a linha para um único tipo `Order`.

Todos os números citados abaixo foram **verificados diretamente nos arquivos** (não estimados),
para servir de base sólida de decisão.

---

## 1. Inventário e classificação em famílias

| # | Arquivo | Família | Grão | Linhas de dado |
|---|---|---|---|---|
| 1 | `ConsultaPedidos_*.xlsx` | A — Transacional bruto | 1 pedido | 3.939 |
| 2 | `ConsultaRankingVendas_*.csv` | A — Transacional bruto | 1 item vendido | 26.452 |
| 3 | `GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv` | B — Meta Sell-In | 1 ciclo | 1 |
| 4 | `GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv` | B — Meta Sell-In | 1 SKU × PDV | 16 |
| 5 | `ReceitaCanalVD_Performance_por_PDV.xlsx` | C — BI agregado | UN × PDV × canal | 8 |
| 6 | `ReceitaCanalVD_por_Periodo.xlsx` | C — BI agregado | — | **0 (arquivo sem aba de dados, ver §6.4)** |
| 7 | `ReceitaCanalVD_por_UN.xlsx` | C — BI agregado | UN | 4 |
| 8 | `Receita_por_Canal_UN.xlsx` | C — BI agregado | canal/UN | 12 |
| 9 | `Receita_por_Cat_Sub_Mar.xlsx` | C — BI agregado | categoria/subcat/linha/marca | 12+14+14+4 |
| 10 | `Receita_por_Periodo.xlsx` | C — BI agregado | dia / mês | 22+3 |
| 11 | `RupturaVD_Ruptura_causa_franqueado.xlsx` | C — BI agregado | ciclo | 1 |
| 12 | `RupturaVD_Ruptura_detalhada_ciclo.xlsx` | C — BI agregado | ciclo | 1 |
| 13 | `RupturaVD_detalhamento_ruptura_por_item.xlsx` | C — BI agregado | SKU × PDV | 57 |
| 14 | `VendaDireta_Ativas_por_tier.xlsx` | C — BI agregado | segmento de recência | 6 |
| 15 | `VendaDireta_Detalhamento_de_Categorias_e_UN...xlsx` | C — BI agregado | UN / categoria | 5+3 |
| 16 | `VendaDireta_Evolucao_da_base.xlsx` | C — BI agregado | ciclo | 1 |
| 17 | `VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx` | C — BI agregado | PDV / supervisor | 2+13 |
| 18 | `VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx` | C — BI agregado | ciclo | 1 |
| 19 | `VendaDireta_Segmentacao_da_Base.xlsx` | C — BI agregado | recência × tier | 7 |
| 20 | `VendaDireta_penetracao_base.xlsx` | C — BI agregado | ciclo | 9 |

(18 arquivos, 20 linhas na tabela porque dois arquivos têm duas abas de dado relevantes contadas
separadamente onde fazia sentido.)

**Família A** são extrações "cruas" do sistema operacional (mesma origem do `ConsultaPedidos.xlsx`
que já alimentava o Modo VD, mais um arquivo novo de vendas por item). **Família B** é sell-**in**
(reposição franqueado↔indústria), um domínio que **não existe hoje** no Modo VD. **Família C** é a
maior novidade: 14 planilhas exportadas de um BI corporativo, já pré-agregadas (pivots), cada uma
respondendo a **uma pergunta de negócio específica**, sempre comparando **ciclo atual vs. ciclo/período
anterior**.

---

## 2. Família A — Dados transacionais brutos

### 2.1 `ConsultaPedidos.xlsx` (grão: pedido)

- Aba única `Pag`, **3.939 pedidos**, mas agora com **89 colunas** (o `COLUMN_MAP` atual só
  reconhece ~38). O restante é hoje descartado silenciosamente — o que é um comportamento correto
  para colunas irrelevantes, mas aqui há colunas com valor real de negócio sendo jogadas fora:

  | Coluna nova | Observação |
  |---|---|
  | `ModeloComercial` / `CódModeloComercial` | **É o campo de canal real**: `Online` (2.883), `Presencial` (989), `Modelo - OMNIChannel` (67). Ver cruzamento §5.2 — bate com a receita "VD" vs "OMNI" dos relatórios de BI. |
  | `CaptacaoRestrita` | Flag Sim/Não (390 pedidos = Sim). Significado de negócio não documentado; precisa confirmação. |
  | `CicloIndicador` / `CicloCancelamento` | Diferem de `Ciclo Captação`/`Ciclo Marketing` (que são sempre `13/2026` neste extrato): 24 pedidos já aparecem com `CicloIndicador = 14/2026`. Sugere que o corte de ciclo é por data de evento, não por um campo fixo. |
  | `DetalheMeioCaptacao` | App/canal técnico de origem: `apprebotiflutter` (1.991), `backOfficePDV` (1.526), `Portal FVC` (22), `portalreBotiStargate` (17). |
  | `Cód Usuário Criação` / `Cód Usuário Finalização` | Versão numérica de `UsuarioCriacao`/`UsuarioFinalizacao`, útil para join estável (nomes têm variação de grafia). |
  | `PlanoPagamento`, `Tipo de Entrega`, `EstruturaPai` (texto), `Cod Transportadora`/`Transportadora`, `CategoriaDispositivo` (hoje só `Desktop`, pouco informativo), `Pedido Relacionado`/`Tipo de Relacionamento` (vazios neste extrato) | Potencial valor futuro, hoje pouco ou nada preenchidos. |

- **`Papel` (tier) continua batendo com os 10 tiers fixos** do `papelToTierId` atual: Bronze (1.102),
  Prata (862), Ouro (663), Platina (433), Cobre (300), Diamante GB (203), Revendedor (159), Rubi
  (88), Consumidor Final (67), Esmeralda GB (62). Nenhum valor fora da lista — o mapeamento atual
  segue válido para este arquivo.
- **`SituaçãoComercial`**: `Entregue` (3.605), `Transporte` (248), `Separação` (68), `Cancelado`
  (18). A regra `isRevenueEligible` atual (exclui `Cancelado` e `Cancelado Pelo Usuário`) segue
  correta e reduz para 3.921 pedidos elegíveis.
- **Datas**: `Data Captação` vai de 31/08/2026 a **23/09/2026**, ultrapassando a janela "ciclo
  atual" declarada nos relatórios de BI (31/08–20/09/2026). Ou seja, o extrato de pedidos é mais
  recente/abrangente que o corte usado pelo BI corporativo — um filtro de data pode ser necessário
  para comparações "maçã com maçã" (ver §6.2).

### 2.2 `ConsultaRankingVendas.csv` (grão: item vendido) — **arquivo novo**

- Delimitador **`|` (pipe)**, não vírgula — `parseSpreadsheet` precisa de um parser CSV dedicado
  para este arquivo (PapaParse aceita delimiter customizado, mas a detecção teria que ser
  explícita, não pelo `header:true` genérico atual). Encoding UTF-8 com BOM.
- 17 colunas, **26.452 linhas de dado**, sem `CodigoPedido` — o grão é **produto vendido**, não
  pedido. Colunas: `Gerencia` (= `EstruturaPai`/franqueado), `Setor` (= `Estrutura`/equipe),
  `CodigoRevendedora` (= `Pessoa`), `NomeRevendedora`, `QuantidadePontos`, `CicloCaptacao`,
  `CicloFaturamento`, `CodigoProduto`, `NomeProduto`, `Tipo`, `DataCaptacao`, `QuantidadeItens`,
  `Faturamento`, `ValorPraticado`, `ValorVenda`, `Meio Captacao`, `Tipo Entrega`.
- **`Tipo`**: `Venda` (20.843), `Brinde` (4.130), `Doação` (1.079). Só `Venda` deve entrar em
  métricas de receita — `Brinde`/`Doação` têm `ValorPraticado = 0` na maioria dos casos, mas
  representam volume de itens que hoje não é capturado em nenhum lugar do Modo VD (útil para
  métricas de giro/mix de produto).
- **`QuantidadePontos` ≈ `Faturamento` × 100** (razão = 100 em 75% das linhas; cai quando
  `Faturamento = 0`, i.e., brindes/doações). Útil como checagem de consistência, não como regra
  dura.
- ⚠️ **Qualidade de dados — quebras de linha não escapadas**: ~200 registros lógicos (de 26.452,
  ~0,75%) estão fisicamente partidos em 2 ou 3 linhas do arquivo, porque o campo `NomeProduto` de
  alguns SKUs específicos (ex.: SKU `54003` "NIINA SECRETS BATOM LÍQUIDO...", SKU `55764` "SIÀGE
  KIT PRO CRONOLOGY MÁSCARA...", SKU `55800` "EUDORA GLAM PALETTE...") contém uma quebra de linha
  literal (`\n` ou `\r\n`) **sem estar entre aspas**. Verificado byte a byte: a linha física termina
  no meio do `NomeProduto` e a linha seguinte começa com `|Venda|<data>|...`, deslocando todas as
  colunas. Um parser ingênuo (`split('\n')` seguido de `split('|')`, que é essencialmente o que
  PapaParse faz por padrão) produz duas linhas quebradas — a primeira com as 9 primeiras colunas e
  as últimas 8 vazias, a segunda com as 9 primeiras vazias e as últimas 8 preenchidas. **Isso precisa
  de uma etapa de reparo antes do parse "linha = registro"**: agrupar linhas físicas consecutivas até
  acumular 16 delimitadores `|` (17 campos), e só então tratar como um registro.
  - Um caso à parte, **sem bug real**: o SKU `58095` ("COMBO PRO CRONOLOGY | SHAMPOO +
    CONDICIONADOR") tem um `|` **literal dentro do nome do produto**, mas corretamente delimitado
    por aspas (`"..."`). Qualquer parser CSV que respeite aspas (inclusive PapaParse com
    configuração padrão) já lida bem com isso — não precisa de tratamento especial, só não se deve
    fazer um `split('|')` manual ingênuo que ignore aspas.
- **Sobreposição de revendedores com `ConsultaPedidos`**: 2.314 dos 2.320 `CodigoRevendedora`
  aparecem também como `Pessoa` em `ConsultaPedidos` (99,7% de interseção) — confirma que os dois
  arquivos compartilham o mesmo espaço de identificadores de revendedor e podem ser cruzados por
  essa chave.

### 2.3 Cruzamento validado: Pedidos × RankingVendas × BI de receita

Somando `ValorPraticado` dos pedidos **elegíveis** (não cancelados) em `ConsultaPedidos`, o total é
**R$ 3.535.358,18**. O relatório `ReceitaCanalVD_Performance_por_PDV.xlsx` reporta receita atual
"VD" + "OMNI" = **R$ 3.536.654,87**. Diferença de **0,04%** — praticamente idêntico. Em
`ConsultaRankingVendas`, somando `ValorPraticado` só das linhas `Tipo = Venda`, o total é
**R$ 3.513.278,83** — na mesma ordem de grandeza (diferença explicada pela janela de datas mais
ampla do extrato de pedidos, que vai até 23/09 contra o corte de 20/09 do BI).

**Conclusão importante:** a receita "oficial" do BI corporativo é calculada **incluindo** os
pedidos de estrutura `FVC` — ver próximo ponto — porque excluir FVC do total de `ConsultaPedidos`
derruba a soma para R$ 3.114.671,69, **11,9% abaixo** do valor reportado pelo BI.

---

## 3. Família B — Meta de Sell-In (franqueado ↔ indústria)

Domínio **inexistente hoje no Modo VD**. Refere-se a reposição de estoque do franqueado junto à
indústria (Boticário), não a vendas ao consumidor final.

- `GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv`: 1 linha agregada — `Ciclo 13 - 2026`, Sugestão
  Comercial = Pedido Realizado = **4.770** unidades (atingimento 100%).
- `GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv`: 16 linhas (8 SKUs × 2 PDVs), com
  `SKU` como texto combinado `"<código> - <nome>"` (precisa split), `MARCA` (sigla, ex. `BOT`),
  `DATA LIMITE DE CAPTAÇÃO`, sugestão e realizado por SKU/PDV. **A soma das 16 linhas bate
  exatamente com o total agregado (4.770 = 4.770)** — o arquivo de detalhe é a decomposição exata
  do agregado, útil para validar reparse.
- Todos os SKUs mostram 100% de atingimento neste ciclo — não há sinal de ruptura de sell-in nesta
  amostra (diferente da ruptura de sell-**out**, família C, que tem taxas bem mais altas — ver
  §4.2). É importante não confundir os dois conceitos de "ruptura"/"meta" ao nomear campos no
  código.

---

## 4. Família C — Relatórios de BI corporativo (pivots pré-agregados)

Estas 14 planilhas **não são fontes de registro-a-registro**: já vêm agregadas pelo BI, com uma
estrutura de cabeçalho em **múltiplas linhas mescladas** (grupos de coluna, ex. "CICLO ANTERIOR" /
"CICLO ATUAL" / "VARIAÇÃO" acima de sub-colunas "Receita"/"Participação"/"Variação %"). Isso exige
um **parser específico por formato de aba**, não um `COLUMN_MAP` genérico linha-a-linha — a
posição do cabeçalho real varia (às vezes linha 0, às vezes linha 1 ou 2) e algumas células de
cabeçalho estão mescladas (o valor só aparece na primeira célula do grupo, as demais vêm vazias no
array bruto).

### 4.0 Estrutura comum: aba `FILTROS`

Praticamente todos os 14 arquivos trazem uma primeira aba `FILTROS` (chave/valor, 2 colunas) que
funciona como **metadado de contexto do relatório**, não como dado a ser lido linha a linha:

| Filtro | Exemplo | Uso |
|---|---|---|
| `TIPO DE RECEITA` | `Receita GMV + Omni` ou `Receita Bruta` | Define qual métrica de receita o relatório usa — **varia entre relatórios** (ver §6.1). |
| `CICLO ATUAL` / `PERÍODO ATUAL` | `31/08/2026 - 20/09/2026` | Janela do "atual". |
| `CICLO ANTERIOR` / `PERÍODO ANTERIOR` | `01/09/2025 - 21/09/2025` | Janela de comparação — **note que é o ciclo homólogo do ano anterior**, não o ciclo imediatamente anterior. |
| `CP` | `10258` | Código do ponto/franquia — constante em todos os arquivos deste lote. |
| `PDV` / `CANAL` / `UN. DE NEGÓCIO` | `-` (sem filtro aplicado) | Nestes 18 arquivos vêm sempre "todos" — mas o campo existe para relatórios filtrados. |

Um parser deveria extrair esse bloco como um `ReportContext` único por arquivo e usá-lo para
rotular/validar os dados da(s) aba(s) seguinte(s), em vez de tratá-lo como mais uma "tabela".

### 4.1 Receita (6 arquivos)

- **`Receita_por_Periodo.xlsx`** (abas `DIA`, `MÊS`): receita diária (22 dias) e mensal (2 meses)
  comparando período atual vs. anterior. Nota: dia `06/09/2026` aparece com receita **zero nos dois
  períodos** — checar se é dia sem operação (loja fechada) ou falha de captura antes de tratar como
  outlier de negócio.
- **`Receita_por_Canal_UN.xlsx`**: quebra único nível "canal" (Loja/Venda Direta/Omnichannel) ×
  UN (marca). Confirma que **este franqueado só opera Venda Direta** (`Loja` aparece zerada em
  todas as linhas) — um dado importante para não desenhar UI/métricas de loja física para esta
  franquia.
- **`Receita_por_Cat_Sub_Mar.xlsx`** (4 abas: `CATEGORIA`, `SUBCATEGORIA`, `LINHA`, `MARCA`):
  taxonomia de produto em 4 granularidades, todas com o mesmo padrão de colunas (receita
  anterior/atual, participação %, variação). Nenhuma dessas dimensões (categoria, subcategoria,
  linha, marca) existe hoje no `Order` do Modo VD — só existe indiretamente via `NomeProduto` em
  `ConsultaRankingVendas`, sem categorização estruturada.
- **`ReceitaCanalVD_Performance_por_PDV.xlsx`**: o único relatório de receita **granular por PDV**
  (13706/13707) e por UN, com meta, gap e % de atingimento — cruza diretamente com
  `Estrutura`/`Cód Estrutura` de `ConsultaPedidos`.
- **`ReceitaCanalVD_por_UN.xlsx`**: meta por UN com composição "Venda Direta" vs "Omni Envio ER" —
  mesmo cruzamento de canal do §2.3/§5.2, agora com meta.
- **`ReceitaCanalVD_por_Periodo.xlsx`**: ⚠️ **contém apenas a aba `FILTROS`, sem nenhuma aba de
  dado**. Não é erro de leitura nosso — confirmado com `openpyxl` que o arquivo realmente só tem
  uma aba. Ou o BI falhou ao gerar esse export, ou o relatório é redundante com
  `Receita_por_Periodo.xlsx` (que tem os mesmos dados por dia/mês) e por isso saiu vazio. Um parser
  robusto precisa **tolerar esse caso** (arquivo de família C sem aba de dado) sem quebrar o
  pipeline geral.

### 4.2 Ruptura (3 arquivos) — indisponibilidade de produto no ponto de venda

- **`RupturaVD_Ruptura_causa_franqueado.xlsx`**: ruptura atribuível ao franqueado (falta de pedido/
  reposição) = **0,07%** no ciclo.
- **`RupturaVD_Ruptura_detalhada_ciclo.xlsx`**: ruptura total do ciclo = **7,83%**, decomposta em
  `% RUPTURA CF (IAF)` = 0,07% (mesmo número do arquivo anterior) e `% RUPTURA CAUSA INDUSTRIA` =
  7,76%. **A maior parte da ruptura não é culpa do franqueado** — é falta de estoque na indústria.
  (Sigla `IAF` não documentada nos dados — provavelmente "Item(ns) de Alta Frequência" ou
  equivalente; recomenda-se confirmar com quem gera o relatório antes de expor a sigla na UI.)
- **`RupturaVD_detalhamento_ruptura_por_item.xlsx`**: 57 linhas SKU × PDV com `CAUSA RUPTURA`
  (`-` ou `Causa Franqueado`) e `% DE RUPTURA`. É uma **amostra**, não o catálogo completo (o
  catálogo real tem milhares de SKUs, conforme `ConsultaRankingVendas`) — provavelmente lista só os
  SKUs monitorados/críticos. Não deve ser tratado como universo completo de produtos.

### 4.3 Base de revendedores — Penetração, Segmentação, Monitoramento (6 arquivos)

Este é o grupo com os cruzamentos mais ricos, e também o de nomenclatura mais confusa — vale
atenção redobrada ao nomear os conceitos no código:

- **`VendaDireta_Evolucao_da_base.xlsx`**: base ativa 5.228, 168 inícios, 136 reinícios, base
  multimarca 4.549 (87,01%). Só 1 linha, só ciclo atual (não tem "anterior" aqui).
- **`VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx`** (abas `POR PDV` e `POR SUPERVISOR`):
  base total, base ativa, ativos, base multimarca, **RPA (receita por ativo)**, inativos I1-a-I3 /
  I4-a-I6, % atividade, % churn, inícios, reinícios, "I6 recuperados", perda da base — tudo por PDV
  (2 linhas) e por supervisor (13 supervisores, nomes = mesmo campo `ResponsavelEstrutura` de
  `ConsultaPedidos`, cruzamento direto e confiável).
- **`VendaDireta_penetracao_base.xlsx`**: versão período-anterior-vs-atual das mesmas métricas de
  base (total, ativa, multimarca, mono marca, ativos) em formato "linha por métrica" em vez de
  "coluna por métrica".
- **`VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx`**: 1 linha muito larga (32 colunas) com o
  mesmo conjunto de bases + repique por UN (O Boticário, QDB, Eudora, OUI, FRJ) **e** por categoria
  (Make, Cuidados Faciais) misturados no mesmo nível — os nomes de coluna não distinguem
  "marca"/UN de "categoria de produto", o que é uma inconsistência de modelagem a resolver antes de
  desenhar uma tabela normalizada.
- **`VendaDireta_Ativas_por_tier.xlsx`**: ⚠️ **nome do arquivo é enganoso**. As 6 linhas são
  `I1`...`I6` — **não são os 10 tiers comerciais** (`Papel`/`Bronze`/`Prata`/...), são **faixas de
  recência/inatividade**. Confirmado por triangulação exata: I1+I2+I3 (ciclo atual) = 1.042+811+609
  = **2.462**, que bate exatamente com `INATIVOS I1 a I3` do relatório de Monitoramento; I4+I5+I6 =
  304+294+151 = **749**, que bate exatamente com `INATIVOS I4 a I6`. Ou seja: **I1 a I6 = tempo de
  inatividade em ciclos consecutivos sem comprar** (I1 = inativo há 1 ciclo, ..., I6 = inativo há
  6+ ciclos ou "churned"), não nível de revendedor.
- **`VendaDireta_Segmentacao_da_Base.xlsx`** (aba `SEGMENTAÇÃO DA BASE CGB`): cruzamento **recência
  (A0, I1-I6) × tier comercial** (`BLUE`, `COBRE`, `BRONZE`, `PRATA`, `OURO`, `PLATINA`, `RUBI`,
  `ESMERALDA GB`, `DIAMANTE GB`, `REVENDEDOR`, `SEM CLASSIFICAÇÃO`). Validação fechada:
  - Soma da linha `A0` (todas as colunas de tier) = **2.321** = exatamente o `ATIVOS DA BASE TOTAL`
    do Monitoramento. Logo **`A0` = ativo no ciclo atual**.
  - Soma de cada linha `I1`...`I6` bate, célula a célula, com os valores da planilha "Ativas por
    Tier" (1.042 / 811 / 609 / 304 / 294 / 151).
  - Soma de **tudo** (`A0` + `I1`...`I6`) = 2.321 + 3.211 = **5.532** = exatamente a `Base Total`.
  Ou seja, essa planilha é a **decomposição completa e consistente** da base total do franqueado
  por recência × tier comercial — é a fonte mais rica para segmentação de revendedores, mas exige
  reconciliar duas taxonomias de tier diferentes (ver §6.3).

---

## 5. Cruzamentos validados entre famílias (resumo com números)

| Cruzamento | Chave | Evidência |
|---|---|---|
| `ConsultaPedidos.Pessoa` ↔ `ConsultaRankingVendas.CodigoRevendedora` | ID do revendedor | 99,7% de interseção (2.314/2.320) |
| `ConsultaPedidos.Estrutura`/`Cód Estrutura` ↔ PDV dos relatórios de BI | Código do PDV (`13706`/`13707`) | Mesmos dois códigos aparecem em `Performance por PDV`, `Monitoramento`, `Gestão de Pedidos` |
| `ConsultaPedidos.ModeloComercial` ↔ canal "VD"/"OMNI" do BI | Canal | `Online`+`Presencial` = R$ 3.524.711,78 ≈ receita "VD" do BI (R$ 3.526.795,43, diff 0,06%); `Modelo - OMNIChannel` = R$ 10.646,40 ≈ receita "OMNI" do BI (R$ 9.859,44, diff ~8%, provavelmente por janela de datas) |
| `ConsultaPedidos.ResponsavelEstrutura` ↔ `Monitoramento por Supervisor.SUPERVISOR` | Nome do supervisor | Mesmos 13 nomes nas duas fontes |
| Receita total elegível de `ConsultaPedidos` (incluindo FVC) ↔ receita "atual" do BI | Valor agregado | R$ 3.535.358,18 vs. R$ 3.536.654,87 (diff 0,04%) |
| `VendaDireta_Ativas_por_tier` (I1-I6) ↔ `Monitoramento` (inativos) ↔ `Segmentação da Base` (linhas I1-I6) | Segmento de recência | Soma exata em 3 arquivos independentes (ver §4.3) |

---

## 6. Inconsistências e decisões de negócio em aberto

Estas questões **precisam de decisão humana** antes de codificar a lógica definitiva — não dá para
resolver só olhando os dados:

1. **Tipo de receita não é padronizado entre relatórios.** A aba `FILTROS` mostra `TIPO DE RECEITA`
   variando entre `Receita GMV + Omni` (relatórios de receita/base) e `Receita Bruta` (relatórios de
   ruptura). Comparar números entre um relatório e outro sem checar esse filtro pode gerar
   conclusões erradas.
2. **Janela de datas do extrato de pedidos (`ConsultaPedidos`) é mais ampla que o "ciclo atual" do
   BI** (até 23/09 vs. corte em 20/09). Qualquer reconciliação numérica entre Família A e Família C
   deveria aplicar o mesmo filtro de data, ou aceitar a pequena divergência residual documentada em
   §2.3.
3. **FVC: incluir ou excluir?** O pipeline atual do Modo VD **exclui inteiramente** pedidos de
   estrutura `FVC` do dataset. Neste lote, FVC representa **19,3% dos pedidos e ~12% do
   faturamento**, e os números "oficiais" do BI corporativo **batem apenas quando FVC é incluído**
   (§2.3). Manter a exclusão atual faria os totais do Modo VD divergirem significativamente dos
   relatórios corporativos que o franqueado já usa. Precisa de decisão: manter exclusão (e assumir
   a divergência), reclassificar FVC como uma dimensão/filtro em vez de exclusão, ou remover a
   exclusão.
4. **Duas taxonomias de tier coexistindo.** `ConsultaPedidos.Papel` usa os 10 valores já conhecidos
   pelo `papelToTierId` (`Revendedor, Cobre, Bronze, Prata, Ouro, Platina, Rubi, Esmeralda GB,
   Diamante GB, Consumidor Final`). `VendaDireta_Segmentacao_da_Base` usa 11 categorias diferentes
   (`BLUE, COBRE, BRONZE, PRATA, OURO, PLATINA, RUBI, ESMERALDA GB, DIAMANTE GB, REVENDEDOR, SEM
   CLASSIFICAÇÃO`) — sem `Consumidor Final`, com `BLUE` e `SEM CLASSIFICAÇÃO` novos. Não é possível
   inferir a correspondência apenas pelos dados; precisa confirmação de negócio antes de unificar
   `papelToTierId`.
5. **Nomenclatura de UN (marca) não é padronizada entre arquivos**: o mesmo grupo aparece como
   `O Boticário` / `O Boticario` / `BOTICÁRIO` / `O BOTICÁRIO`; Eudora aparece como `Eudora` / `EUD`
   / `EUDORA`; O.U.I aparece como `O.U.I` / `OUI`; e há um código `FRJ` sem contexto (zerado em todos
   os relatórios deste ciclo, aparência de UN nunca operada por este franqueado). Um dicionário de
   canonicalização (nos moldes do `COLUMN_MAP`/`papelToTierId` atuais) é necessário antes de juntar
   dados de UN entre relatórios diferentes.
6. **`RupturaVD_detalhamento_ruptura_por_item` não é exaustivo** (57 SKUs vs. milhares no catálogo
   real) — tratar como amostra/watchlist, não como base completa de ruptura por item.
7. **Siglas não documentadas**: `IAF` (ruptura), `CGB` (segmentação da base), `CP` (código do
   ponto). Recomenda-se glossário confirmado com a área de negócio antes de expor esses termos em
   UI.

---

## 7. Proposta de fluxo de leitura atualizado (visão de alto nível)

Ao contrário do fluxo único da v1 (`arquivo → parseSpreadsheet → Order[] → useOrderStore`), a
proposta é um pipeline com **três entradas paralelas, convergindo em cruzamentos explícitos**:

```
Família A (grão fino, evento a evento)
  ConsultaPedidos.xlsx ────────┐
  ConsultaRankingVendas.csv ───┼──(reparo de linhas quebradas)──▶ eventos normalizados
                                │        (Pessoa/CodigoRevendedora, PDV, ModeloComercial→canal)
                                ▼
                         dataset transacional (substitui/estende Order[])

Família B (meta sell-in)
  GestaoPedidos_*.csv ─────────────────────────────────────────▶ dataset de metas de reposição
                                                                   (SKU × PDV × ciclo)

Família C (pivots do BI corporativo, 14 arquivos)
  cada arquivo:
    aba FILTROS ──▶ ReportContext (tipo de receita, período atual/anterior, CP, PDV, canal, UN)
    aba(s) de dado ──▶ parser específico por formato de pivot
                        (cabeçalho multi-linha, grupos mesclados) ──▶ fatos agregados já prontos
                        [tolerante a arquivo sem aba de dado, ex. §4.1 ReceitaCanalVD_por_Periodo]

                                ▼
                    camada de cruzamento (chaves: Pessoa/CodigoRevendedora,
                    PDV/Estrutura, ResponsavelEstrutura/Supervisor, ciclo)
                                ▼
              reconciliação e alertas de divergência (ex.: receita Família A vs. Família C;
              inclusão/exclusão de FVC; tier Papel vs. tier Segmentação da Base)
                                ▼
                         telas / métricas (existentes + novas: sell-in, ruptura,
                         segmentação de base por recência, penetração de UN/categoria)
```

Pontos de atenção de implementação:
- O parser de Família C precisa ser **por formato de aba**, não genérico — os 14 arquivos usam pelo
  menos 6 layouts de cabeçalho diferentes (comparado ao `COLUMN_MAP` único e genérico da v1).
- O reparo de linhas quebradas do `ConsultaRankingVendas.csv` precisa rodar **antes** de qualquer
  parse "uma linha = um registro" (ver §2.2).
- Cada arquivo de Família C deveria carregar seu próprio `ReportContext` (da aba `FILTROS`) junto
  com os dados, para permitir validação cruzada de período e tipo de receita antes de somar números
  de arquivos diferentes.

---

## 8. O que ainda não é possível fazer com este lote (limitações herdadas + novas)

- Só há dados de **um ciclo** (Ciclo 13) mais a comparação embutida "ciclo/período anterior" de cada
  relatório — não há histórico de vários ciclos passados para montar séries temporais mais longas
  que as 2 janelas já trazidas por arquivo.
- Nenhum arquivo traz **categoria/marca por produto vinculada ao `CodigoProduto`** de forma
  explícita e granular — a taxonomia (categoria/subcategoria/linha/marca) só existe pré-agregada em
  `Receita_por_Cat_Sub_Mar.xlsx`, sem uma tabela de-para SKU → categoria para juntar com
  `ConsultaRankingVendas` item a item.
- `RupturaVD_detalhamento_ruptura_por_item` cobre poucos SKUs — não dá para calcular ruptura por
  item de forma abrangente com o que foi enviado.
- Ainda não há um dicionário de negócio confirmado para `IAF`, `CGB`, `CaptacaoRestrita`, `BLUE` e
  `SEM CLASSIFICAÇÃO` — qualquer métrica nova que dependa desses conceitos deve aguardar
  confirmação antes de ir para produção.
