# Leitura de Planilhas — Modo VD v2 (Camada de Dados Corporativos, Ciclo 13 · atualizado para o Ciclo 14 na §10)

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
| 5 | `ReceitaCanalVD_Performance_por_PDV.xlsx` | C — Extranet (agregado) | UN × PDV × canal | 8 |
| 6 | `ReceitaCanalVD_por_Periodo.xlsx` | C — Extranet (agregado) | — | **0 (arquivo sem aba de dados, ver §6.4)** |
| 7 | `ReceitaCanalVD_por_UN.xlsx` | C — Extranet (agregado) | UN | 4 |
| 8 | `Receita_por_Canal_UN.xlsx` | C — Extranet (agregado) | canal/UN | 12 |
| 9 | `Receita_por_Cat_Sub_Mar.xlsx` | C — Extranet (agregado) | categoria/subcat/linha/marca | 12+14+14+4 |
| 10 | `Receita_por_Periodo.xlsx` | C — Extranet (agregado) | dia / mês | 22+3 |
| 11 | `RupturaVD_Ruptura_causa_franqueado.xlsx` | C — Extranet (agregado) | ciclo | 1 |
| 12 | `RupturaVD_Ruptura_detalhada_ciclo.xlsx` | C — Extranet (agregado) | ciclo | 1 |
| 13 | `RupturaVD_detalhamento_ruptura_por_item.xlsx` | C — Extranet (agregado) | SKU × PDV | 57 |
| 14 | `VendaDireta_Ativas_por_tier.xlsx` | C — Extranet (agregado) | segmento de recência | 6 |
| 15 | `VendaDireta_Detalhamento_de_Categorias_e_UN...xlsx` | C — Extranet (agregado) | UN / categoria | 5+3 |
| 16 | `VendaDireta_Evolucao_da_base.xlsx` | C — Extranet (agregado) | ciclo | 1 |
| 17 | `VendaDireta_Monitoramento_base_PDV_Supervisor.xlsx` | C — Extranet (agregado) | PDV / supervisor | 2+13 |
| 18 | `VendaDireta_Penetracao_de_Ativos_Detalhada.xlsx` | C — Extranet (agregado) | ciclo | 1 |
| 19 | `VendaDireta_Segmentacao_da_Base.xlsx` | C — Extranet (agregado) | recência × tier | 7 |
| 20 | `VendaDireta_penetracao_base.xlsx` | C — Extranet (agregado) | ciclo | 9 |

(18 arquivos, 20 linhas na tabela porque dois arquivos têm duas abas de dado relevantes contadas
separadamente onde fazia sentido.)

**Família A** são extrações "cruas" do sistema operacional (mesma origem do `ConsultaPedidos.xlsx`
que já alimentava o Modo VD, mais um arquivo novo de vendas por item). **Família B** é sell-**in**
(reposição franqueado↔indústria), um domínio que **não existe hoje** no Modo VD. **Família C** é a
maior novidade: 14 planilhas exportadas da Extranet, já pré-agregadas (pivots), cada uma
respondendo a **uma pergunta de negócio específica**, sempre comparando **ciclo atual vs. ciclo/período
anterior**.

**Plataforma de origem pelo nome do arquivo:** arquivo que começa com timestamp (`20261016_...`) vem
da **Extranet**; arquivo que começa com texto (`ConsultaPedidos`, `ConsultaRankingVendas`) vem da
**VD+**. Ou seja, a Família A é VD+, e as Famílias B e C são Extranet (os `GestaoPedidos_*` também
chegam com timestamp).

---

## 2. Família A — Dados transacionais brutos

### 2.1 `ConsultaPedidos.xlsx` (grão: pedido)

- Aba única `Pag`, **3.939 pedidos**, mas agora com **89 colunas** (o `COLUMN_MAP` atual só
  reconhece ~38). O restante é hoje descartado silenciosamente — o que é um comportamento correto
  para colunas irrelevantes, mas aqui há colunas com valor real de negócio sendo jogadas fora:

  | Coluna nova | Observação |
  |---|---|
  | `ModeloComercial` / `CódModeloComercial` | **É o campo de canal real**: `Online` (2.883), `Presencial` (989), `Modelo - OMNIChannel` (67). Ver cruzamento §5.2 — bate com a receita "VD" vs "OMNI" dos relatórios da Extranet. |
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
  atual" declarada nos relatórios da Extranet (31/08–20/09/2026). Ou seja, o extrato de pedidos é mais
  recente/abrangente que o corte usado pela Extranet — um filtro de data pode ser necessário
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

### 2.3 Cruzamento validado: Pedidos × RankingVendas × receita da Extranet

Somando `ValorPraticado` dos pedidos **elegíveis** (não cancelados) em `ConsultaPedidos`, o total é
**R$ 3.535.358,18**. O relatório `ReceitaCanalVD_Performance_por_PDV.xlsx` reporta receita atual
"VD" + "OMNI" = **R$ 3.536.654,87**. Diferença de **0,04%** — praticamente idêntico. Em
`ConsultaRankingVendas`, somando `ValorPraticado` só das linhas `Tipo = Venda`, o total é
**R$ 3.527.186,61** — praticamente a receita **VD** da Extranet (R$ 3.526.795,43, diferença de R$ 391). O
valor que constava antes neste documento (R$ 3.513.278,83) não se reproduz: duas leituras
independentes (a do app e a da §9) chegam aos mesmos R$ 3.527.186,61. A origem da diferença não foi
identificada; as 18 linhas com `|` dentro de um nome entre aspas somam só R$ 1.650,99 e não a explicam.
Ver §9.

**Conclusão importante:** a receita "oficial" da Extranet é calculada **incluindo** os
pedidos de estrutura `FVC` — ver próximo ponto — porque excluir FVC do total de `ConsultaPedidos`
derruba a soma para R$ 3.114.671,69, **11,9% abaixo** do valor reportado pela Extranet.

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

## 4. Família C — Relatórios da Extranet (pivots pré-agregados)

Estas 14 planilhas **não são fontes de registro-a-registro**: já vêm agregadas pela Extranet, com uma
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
| `CP` | `10258` | Código Pai (franquia) — constante em todos os arquivos deste lote. |
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
  uma aba. Ou a Extranet falhou ao gerar esse export, ou o relatório é redundante com
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
  base total, base ativa, ativos, base multimarca, **RPA (real por ativo)**, inativos I1-a-I3 /
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
| `ConsultaPedidos.Estrutura`/`Cód Estrutura` ↔ PDV dos relatórios da Extranet | Código do PDV (`13706`/`13707`) | Mesmos dois códigos aparecem em `Performance por PDV`, `Monitoramento`, `Gestão de Pedidos` |
| `ConsultaPedidos.ModeloComercial` ↔ canal "VD"/"OMNI" da Extranet | Canal | `Online`+`Presencial` = R$ 3.524.711,78 ≈ receita "VD" da Extranet (R$ 3.526.795,43, diff 0,06%); `Modelo - OMNIChannel` = R$ 10.646,40 ≈ receita "OMNI" da Extranet (R$ 9.859,44, diff ~8%, provavelmente por janela de datas) |
| `ConsultaPedidos.ResponsavelEstrutura` ↔ `Monitoramento por Supervisor.SUPERVISOR` | Nome do supervisor | Mesmos 13 nomes nas duas fontes |
| Receita total elegível de `ConsultaPedidos` (incluindo FVC) ↔ receita "atual" da Extranet | Valor agregado | R$ 3.535.358,18 vs. R$ 3.536.654,87 (diff 0,04%) |
| `VendaDireta_Ativas_por_tier` (I1-I6) ↔ `Monitoramento` (inativos) ↔ `Segmentação da Base` (linhas I1-I6) | Segmento de recência | Soma exata em 3 arquivos independentes (ver §4.3) |

---

## 6. Inconsistências e decisões de negócio em aberto

Estas questões **precisam de decisão humana** antes de codificar a lógica definitiva — não dá para
resolver só olhando os dados:

1. **Tipo de receita não é padronizado entre relatórios.** A aba `FILTROS` mostra `TIPO DE RECEITA`
   variando entre `Receita GMV + Omni` (relatórios de receita/base) e `Receita Bruta` (relatórios de
   ruptura). Comparar números entre um relatório e outro sem checar esse filtro pode gerar
   conclusões erradas.
   **Conferido (28/09/2026):** os 6 relatórios de receita declaram `Receita GMV + Omni`; os 3 de
   ruptura, `Receita Bruta`; `VendaDireta_penetracao_base` e `VendaDireta_Detalhamento_de_Categorias_e_UN`,
   `Receita GMV`; os outros 5 de base não trazem a linha. Como ruptura e base não somam R$, a
   verificação de qualidade compara o tipo só entre os relatórios de receita.
2. **Janela de datas do extrato de pedidos (`ConsultaPedidos`) é mais ampla que o "ciclo atual" do
   Extranet** (até 23/09 vs. corte em 20/09). Qualquer reconciliação numérica entre Família A e Família C
   deveria aplicar o mesmo filtro de data, ou aceitar a pequena divergência residual documentada em
   §2.3.
3. **FVC: incluir ou excluir?** O pipeline atual do Modo VD **exclui inteiramente** pedidos de
   estrutura `FVC` do dataset. Neste lote, FVC representa **19,3% dos pedidos e ~12% do
   faturamento**, e os números "oficiais" da Extranet **batem apenas quando FVC é incluído**
   (§2.3). Manter a exclusão atual faria os totais do Modo VD divergirem significativamente dos
   relatórios corporativos que o franqueado já usa. Precisa de decisão: manter exclusão (e assumir
   a divergência), reclassificar FVC como uma dimensão/filtro em vez de exclusão, ou remover a
   exclusão.
   **Decisão (25/09/2026):** os pedidos FVC ficam no dataset (Receita & Metas, reconciliação e demais
   telas continuam com eles, como a Extranet). A **Visão geral** mostra o faturamento **sem FVC**, e a
   participação das FVCs, junto com o faturamento total, fica numa tela própria (**FVC**). No Ciclo 13:
   total VD R$ 3.524.711,78 = sem FVC R$ 3.104.025,29 + FVC R$ 420.686,49 (11,9%), em 7 estruturas
   "FVC - …" de 3 supervisoras, todas 100% FVC.
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
7. **Siglas não documentadas**: `IAF` (ruptura) e `CGB` (segmentação da base) — fora do glossário
   da UI até alguém da área de negócio confirmar. Confirmadas pelo time (19/10/2026): `CP` = Código
   Pai, `PEF` = Ponto de Equilíbrio Financeiro, `RPA` = Real por Ativo, `ER` = Espaço do Revendedor;
   na aderência por curva, a curva A é a de maior giro e a E a de menor.

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

Família C (pivots da Extranet, 14 arquivos)
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

---

## 9. Dupla verificação (25/09/2026)

Tudo refeito com uma **segunda leitura independente**: os xlsx foram abertos direto do XML, sem a
biblioteca `xlsx` usada pelo app, e o CSV do ranking foi lido com um reparo de linhas próprio. Os
resultados foram comparados com a saída dos parsers do app e **cruzados entre relatórios**.

### 9.1 Leitura do app × leitura bruta

- 14 de 15 relatórios da Extranet: **100% dos números** da planilha aparecem idênticos no dataset do app.
- `Receita_por_Cat_Sub_Mar`: o app não guarda a linha TOTAL nem a coluna "VARIAÇÃO RECEITA (R$)" (168
  números), mas as quatro abas somam exatamente o TOTAL (R$ 3.536.654,87) e a variação é reconstruída
  sem diferença.
- **Comparação campo a campo** (valor lido na posição certa, não só "o número existe"): 2.299 células
  dos relatórios da Extranet, 109 campos das abas `FILTROS`, 55.146 campos dos 3.939 pedidos (casados por
  `CodigoPedido`) e 315.024 campos dos 26.252 registros do ranking. Divergências: só 5 nomes de marca,
  padronizados de propósito pelo app ("QDB"/"Quem Disse Berenice" → "Quem Disse, Berenice?",
  "O BOTICÁRIO" → "O Boticário", "EUDORA" → "Eudora").
- Pedidos: 3.921 elegíveis, R$ 3.535.358,18 nas duas leituras. Ranking: 21.034 linhas `Venda`,
  R$ 3.527.186,61 nas duas leituras. Os 10 valores de `Papel` caem cada um no seu tier.

### 9.2 Cruzamentos entre relatórios que fecham (diferença ≤ R$ 0,01 ou arredondamento do %)

171 conferências fecham e 6 divergem (explicadas em §9.3).

| Verificação | Resultado |
|---|---|
| Performance por PDV: linhas somam a linha TOTAL; VD + OMNI = TOTAL em cada linha; gap = atual − meta; realizado = atual ÷ meta | 57/57 |
| Receita total atual (R$ 3.536.654,87) e anterior (R$ 3.408.352,86) iguais em Performance por PDV, por_UN, Canal_UN e nas 4 abas de Cat/Sub/Linha/Marca | 8/8 |
| Receita por marca (BOT, EUD, OUI, QDB): atual, anterior e meta iguais em Performance por PDV, por_UN, Canal_UN e aba MARCA | 20/20 |
| por_UN: "Venda Direta" + "Omni Envio ER" = realizado; Σ "Venda Direta" das UNs = VD do Performance por PDV (R$ 3.526.795,43) | 13/13 |
| Base ativa (5.228), base total (5.532), ativos (2.321), inícios (168), reinícios (136), multimarca (4.549) iguais em Evolução, Monitoramento, Penetração de base e Penetração detalhada | 13/13 |
| Monitoramento: PDVs e supervisores (27 linhas) somam o TOTAL em todas as colunas de contagem | 20/20 |
| Recência: Ativas por tier I1–I6 = Segmentação (soma dos tiers por linha) = Monitoramento "Inativos I1 a I3 / I4 a I6"; Segmentação **A0 = ativos** (2.321); ativos + inativos I1–I6 = base total | 10/10 |
| Penetração por UN/categoria: Detalhamento de Categorias e UN = Penetração detalhada; % = ativos da UN ÷ 2.321 | 10/10 |
| Ruptura: CF (0,07%) + indústria (7,76%) = total (7,83%); CF igual nos dois relatórios | 2/2 |
| Sell-In: Σ por SKU = meta do ciclo (4.770 sugeridos, 4.770 realizados) | 2/2 |

### 9.3 Diferenças encontradas e explicação

- **"Venda Direta" no `Receita_por_Canal_UN` já inclui o Omni** (= TOTAL). A linha "Omnichannel VD" é
  um subconjunto dela: somar as duas conta o Omni duas vezes.
- **`Receita_por_Periodo` é por data de faturamento**, não por captação: de 03/09 a 19/09 bate dia a
  dia com a `DataFaturamento` dos pedidos (diferenças de até ~R$ 70/dia). Por isso o TOTAL dele
  (R$ 3.482.159,06) difere dos outros relatórios em R$ 54.495,81. Os dias zerados no ciclo atual
  (06, 13 e 20/09 são domingos, 07/09 é feriado e 16/09 é uma quarta-feira) também não têm nenhum
  pedido com `DataFaturamento` no extrato: são dias sem faturamento, não falha do relatório. A quarta
  16/09 sem faturamento é a única que foge do padrão e vale confirmar com a operação. Entre 31/08 e 02/09 a Extranet traz ~R$ 358 mil a mais, provavelmente
  pedidos captados no ciclo anterior e faturados nesses dias, que não estão no extrato do Ciclo 13.
- **O total da Extranet já cobre o extrato inteiro de pedidos.** Apesar de a aba `FILTROS` dizer "31/08/2026 -
  20/09/2026", a receita da Extranet (R$ 3.536.654,87) bate com todos os pedidos elegíveis até 23/09
  (R$ 3.535.358,18). Cortar os pedidos em 20/09 (por captação) derruba a soma para R$ 3.230.655,87.
  Isso contradiz o ponto 2 da §6: não é preciso filtrar os pedidos por data para comparar com a Extranet.
- **Tier "Revendedor" dos pedidos = "SEM CLASSIFICAÇÃO" da Segmentação** (107 × 107, e a coluna
  REVENDEDOR da Segmentação é 0). Resolve em parte o ponto 4 da §6. Platina, Rubi, Esmeralda GB e
  Diamante GB batem exatos; Cobre (269 × 274), Bronze (886 × 880), Prata (576 × 575) e Ouro (305 × 306)
  diferem em até 6 revendedores. Ninguém muda de tier dentro do extrato, então a diferença vem de a Extranet
  classificar o tier em outro momento.
- **PDV nos pedidos**: o código do PDV está no prefixo de `EstruturaPai` ("13707 - ACQUA..."). Por
  ele, a receita VD por PDV fica a 0,5% (13706) e 0,15% (13707) da Extranet. Os 67 pedidos OMNI vêm sem
  `EstruturaPai`.
- **Ativos**: pedidos VD têm 2.322 revendedores distintos, o ranking 2.320 e a Extranet 2.321.
- **Multimarca + monomarca dos ativos** soma 2.320 (1 a menos que 2.321) no ciclo atual e 2.131 (16 a
  menos que 2.147) no anterior: inconsistência da própria Extranet.
- **"% Base multimarcas" da Evolução (87,01%)** é 4.549 ÷ base **ativa**, mas 4.549 é a multimarca da
  base **total** (a Penetração dá 82,23% de 5.532). Da base ativa, a multimarca é 4.462 (85,35%).
- **RPA do Monitoramento** ≈ receita VD ÷ ativos: exato no 13706, R$ 0,37 acima no 13707.

---

## 10. Lote do Ciclo 14 (exportado em 16/10/2026)

O lote padrão do Modo VD (`public/dados-padrao-vd/`) passou a ser o do **Ciclo 14 - 2026**
(período atual 21/09/2026 - 12/10/2026, comparado a 22/09/2025 - 12/10/2025). Os arquivos do Ciclo 13
saíram da pasta (continuam no histórico do git). São **37 arquivos** em vez de 20: 18 já conhecidos,
2 renomeados e 17 novos. Como antes, todos os números abaixo foram conferidos direto nos arquivos.

O `ConsultaPedidos_<uuid>.xlsx` e o `ConsultaRankingVendas_<uuid>.csv` foram salvos sem o sufixo
(`ConsultaPedidos.xlsx`, `ConsultaRankingVendas.csv`), como no lote anterior. O extrato tem 3.815
pedidos (todos `CicloMarketing` 14/2026; 28 cancelados) e o ranking, 28.508 itens (178 linhas
reparadas por quebra de linha no nome do produto, ver §2.2).

### 10.1 Inventário

| Situação | Arquivos |
|---|---|
| **Mesmo formato do Ciclo 13** | `GestaoPedidos_Meta_Sell_In_Por_Ciclo.csv`, `GestaoPedidos_Detalhamento_por_Sku_meta_Sell_In_por_Ciclo.csv`, `Receita_por_Canal_UN`, `Receita_por_Cat_Sub_Mar`, os 3 `RupturaVD_*`, os 7 `VendaDireta_*` de base (Evolução, Monitoramento, Penetração de base, Penetração de ativos detalhada, Ativas por tier, Segmentação, Detalhamento de categorias e UN) |
| **Mesmo nome, formato novo** | `ReceitaCanalVD_Performance_por_PDV`, `ReceitaCanalVD_por_UN` (§10.2) |
| **Renomeados** | `ReceitaCanalVD_por_Periodo` → `ReceitaCanalVD_por_Ciclo`; `Receita_por_Periodo` → `Receita_por_Ciclo` (§10.2) |
| **Novos — VendaDireta (GMV)** | `Arvore_De_Pedidos`, `Distribuicao_da_Receita`, `Distribuicao_da_receita_por_categoria`, `Performance_PDV_Supervisor`, `Receita_por_Ciclo`, `Receita_Por_UN` (§10.3) |
| **Novos — base digital** | `ativas_uma_compra_canais_digitais`, `ativas_uma_compra_er`, `Monitoramento_base_com_penetracao_em_ferramentas_digitais_pdv` (§10.3) |
| **Novos — opt-out de catálogo** | `BaseComOptOutDeCatalogo_Base_Total_Com_E_Sem_Opt_Out`, `..._Det_Base_Total_Com_Opt_Out`, `..._Opt_Out_de_Catalogos_BOT_por_PDV` (§10.3) |
| **Novos para o VD — gestão de pedidos** | `GestaoPedidos_Visao_Geral_por_Ciclo.csv`, `GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo.csv`, `GestaoPedidos_Historico_Colocacao_Pedido.csv`, `GestaoPedidos_Aderência_por_Categoria.xlsx`, `GestaoPedidos_Histórico_de_Aderência.xlsx` — o Modo Loja já lia esses formatos (§10.3) |

### 10.2 Mudanças de formato nos arquivos que já existiam

- **`ReceitaCanalVD_Performance_por_PDV`** perdeu os 3 blocos (VD / OMNI ENVIO ER / TOTAL). Agora o
  cabeçalho tem uma linha só — `UN | PDV | CIDADE | LOCAL DO PDV | RECEITA CICLO ANTERIOR | RECEITA
  CICLO ATUAL | META PEF | GAP ACORDADO (R$) | GAP ACORDADO (%) | REALIZADO` — e a **linha TOTAL vem
  antes do cabeçalho**. A base também mudou: "Receita GMV + Omni" no Ciclo 13, **"Receita Bruta"** no
  Ciclo 14, sem bloco Omni separado. O Omni aparece como "Omnichannel VD", R$ 7.686,66, em
  `Receita_por_Canal_UN`; não dá para saber pelo arquivo se ele já está dentro da receita VD (no Ciclo 13
  a linha "Venda Direta" incluía o Omni, §9.3), então o app mostra os dois lado a lado sem somar. O parser detecta o layout pela coluna "RECEITA CICLO ATUAL"
  (`parseReceitaCanalVDPdvXlsxComLayout`, `dataset.receitaCanalVDPdvLayout = 'simples'`) e preenche
  `vd` e `total` com a mesma receita, deixando `omni` zerado.
- **Meta PEF zerada.** `META PEF` vem 0 em todas as linhas da Performance; `ReceitaCanalVD_por_UN` traz
  a meta do CP como 0 e a de cada UN em branco; `ReceitaCanalVD_por_Ciclo` traz "META DO CICLO ATUAL"
  e "META DO CICLO ANTERIOR" = 0. Ou seja: a meta do Ciclo 14 ainda não foi lançada na Extranet. Sem meta, o
  arquivo preenche `GAP ACORDADO (R$)` com a receita inteira e `REALIZADO` com "-". O app mostra "Não
  lançada" e esconde gap e % realizado (Receita & Metas, PDV 360) em vez de exibir R$ 0,00 como meta.
  **Atualização (17/10/2026):** o time informou a meta PEF do canal VD no Ciclo 14 — R$ 4.314.059,88,
  sendo R$ 4.306.411,00 de Venda Direta e R$ 7.648,88 de Omni Envio ER. Ela fica em
  `src/analytics/metaPefCanalVD.ts` (casada pelo CP e pelo "CICLO ATUAL" da aba FILTROS) e só é usada
  quando o arquivo traz meta 0. Como existe só o total do canal, PDVs e UNs continuam sem meta; o %
  realizado e o gap em Receita & Metas comparam a receita VD com a meta VD, e o card Omnichannel VD
  compara com a meta Omni.
- **`ReceitaCanalVD_por_UN`** não traz mais o sub-bloco "Composição Receita:" (VD × Omni) de cada UN —
  `composicao` e `composicaoTotal` ficam vazios.
- **`ReceitaCanalVD_por_Periodo` → `ReceitaCanalVD_por_Ciclo`.** No Ciclo 13 o arquivo só tinha a aba
  FILTROS. Agora tem a aba CICLO: título "META PEF/POC POR CICLO", cabeçalho `CICLO | CICLO ANTERIOR |
  CICLO ATUAL | META DO CICLO ATUAL | META DO CICLO ANTERIOR` e uma linha por ciclo
  (`parseReceitaCanalVDCicloXlsx` → `dataset.receitaCanalVDCiclo`).
- **`Receita_por_Periodo` → `Receita_por_Ciclo`.** As abas DIA e MÊS sumiram; ficou uma aba CICLO com
  o mesmo layout (`RECEITA (R$)` como grupo, depois `CICLO | CICLO ANTERIOR | CICLO ATUAL | VARIAÇÃO
  (%)`, linha TOTAL e uma linha por ciclo). O mesmo `parseReceitaPeriodoXlsx` lê as duas versões
  (`receitaPeriodo.ciclo`). **Consequência: o Ciclo 14 não tem receita por dia** — a análise de dias
  zerados da §9.3 não se aplica a este lote.
- **Bug de detecção corrigido.** O hint `RECEITA_POR_CAT` também casava com
  `VendaDireta_Distribuicao_da_receita_por_categoria`, que era lido como se fosse o
  `Receita_por_Cat_Sub_Mar` (0 linhas) e, dependendo da ordem, sobrescrevia o arquivo certo. Os hints
  dos arquivos VendaDireta agora vêm antes dos genéricos.
- **Acentos no nome do arquivo.** `GestaoPedidos_Aderência_...` e `..._Histórico_de_Aderência` têm
  acento no nome; o `normalizeName` antigo apagava a letra acentuada ("ADERNCIA") e o hint não casava.
  Agora o nome é normalizado sem acento antes (`NFD`).

### 10.3 Arquivos novos

Todos seguem o padrão da §4.0: aba `FILTROS` + abas de dado. Base declarada: os `VendaDireta_*` novos
dizem **"Receita GMV"**; `ativas_uma_compra_*` e `Monitoramento_base_com_penetracao...` dizem "Receita
Bruta" (mas só contam revendedoras); opt-out e gestão de pedidos não declaram base.

**VendaDireta — pedidos e receita GMV** (tela nova *Pedidos & Mix*):

| Arquivo | Abas | Conteúdo (Ciclo 14) |
|---|---|---|
| `VendaDireta_Arvore_De_Pedidos` | PEDIDOS | Rótulo × CICLO ANTERIOR / CICLO ATUAL / VARIAÇÃO (%) (variação como texto "+3,44%"). Linhas: TOTAL (3.690 → 3.817 pedidos), Pedido Médio (R$ 1.125,54 → R$ 1.261,86), 6 faixas de valor (Até R$ 200 … Acima de R$ 1000) e Volume de itens (12,24 → 14,11 por pedido). As faixas somam o TOTAL. |
| `VendaDireta_Distribuicao_da_Receita` | CP, PDV | Receita GMV anterior × atual: CP 10258 R$ 4.153.234,81 → R$ 4.816.524,90 (+15,97%); 13707 R$ 3.408.405,92 (+17,01%); 13706 R$ 1.408.118,98 (+13,53%). |
| `VendaDireta_Receita_por_Ciclo` | CICLO | Mesmo total do CP acima, uma linha por ciclo. |
| `VendaDireta_Receita_Por_UN` | UNIDADE DE NEGÓCIO | Só o ciclo atual, valores inteiros: BOT 3.521.249, EUD 1.211.401, OUI 54.254, QDB 29.622 (soma 4.816.526). |
| `VendaDireta_Distribuicao_da_receita_por_categoria` | CP, PDV, CONSULTOR (A) | 6 macrocategorias (Cabelos, Cuidados da pele, Gifts, Maquiagem, Perfumaria, Outros), cada uma com RECEITA (R$) e PARTICIPAÇÃO (%), mais TOTAL RECEITA. Cabeçalho em 2 linhas; na aba CONSULTOR (A) a linha de categorias vem deslocada 1 coluna, então o parser casa o i-ésimo "RECEITA (R$)" com a i-ésima categoria, pela ordem. A aba CONSULTOR veio sem linhas. |
| `VendaDireta_Performance_PDV_Supervisor` | PDV, SUPERVISOR | RECEITA, QTD PEDIDOS, ITENS POR PEDIDO, PEDIDO MÉDIO e 6 colunas de faixa (ATÉ R$200 … MAIOR QUE R$1.000), com linha TOTAL. Ver §10.4. |

**Base digital** (tela *Base & Segmentação*, card "Canais digitais e Espaço do Revendedor"):

- `ativas_uma_compra_canais_digitais`: 1 linha — 2.125 ativas, 1.185 com uma compra ou mais nos canais
  digitais (55,76%).
- `ativas_uma_compra_er`: 1 linha — 2.125 ativas, 574 com compra no ER (27,01%). "ER" lido como
  Espaço do Revendedor (confirmado pelo time em 19/10/2026).
- `Monitoramento_base_com_penetracao_em_ferramentas_digitais_pdv`: TOTAL + 1 linha por PDV (13707:
  1.401 / 320 ER / 860 digitais; 13706: 724 / 254 / 325). **A coluna se chama "Base Ativa", mas o número
  é o de ativos** (quem comprou no ciclo, 2.125 = `ATIVOS BASE TOTAL` do Monitoramento), não a base
  ativa (5.382).

**Opt-out de catálogo** (tela *Base & Segmentação*, card "Opt-out de catálogos (BOT)"):

- `..._Base_Total_Com_E_Sem_Opt_Out`: base total 5.654 = 5.193 sem opt-out + 461 com opt-out BOT (8,15%).
- `..._Det_Base_Total_Com_Opt_Out`: das 461, 461 em A0-I6, 1 início e 10 reinícios.
- `..._Opt_Out_de_Catalogos_BOT_por_PDV`: 13707 373 de 3.779 (9,87%); 13706 88 de 1.875 (4,69%). As
  revendedoras por PDV são exatamente a base total de cada PDV no Monitoramento.

**Gestão de pedidos** (tela *Sell-In & Reposição*, antes "Sell-In"):

- `GestaoPedidos_Visao_Geral_por_Ciclo.csv`: funil em unidades — sugestão 32.901 → pedido realizado
  33.784 → faturado 29.300 → venda real 15.817, giro 53,98% (= venda real ÷ faturado).
- `GestaoPedidos_Giro_Pedidos_Canais_por_Ciclo.csv`: linhas GERAL (rede inteira, com lojas: 33.596 /
  16.973 / 50,52%) e VD (29.300 / 15.817 / 53,98%). **As colunas trocam de nome entre os dois arquivos**:
  aqui "VOLUME PEDIDO" é o *faturado* da Visão geral e "VOLUME FATURADO" é a *venda real*.
- `GestaoPedidos_Historico_Colocacao_Pedido.csv`: 198 linhas (PDV × SKU das campanhas do ciclo), com
  CAMPANHA, CATEGORIA, MARCA, UN e volumes de sugestão / colocado / faturado; números em formato
  en-US ("0.00%"). Somado, bate exatamente com a Visão geral (32.901 / 33.784 / 29.300).
- `GestaoPedidos_Aderência_por_Categoria.xlsx` e `..._Histórico_de_Aderência.xlsx`: abas Semanal,
  Mensal, Anual, CP, PDV e Categorias (aderência % por curva A/B/C/E). **A Extranet ignora o filtro CANAL**:
  com `CANAL = VD` vêm os 8 PDVs do CP (as 6 lojas também) e números idênticos aos do arquivo do Modo
  Loja (`CANAL = LOJ`). O app reaproveita o parser do Modo Loja e mostra só os PDVs 13706 e 13707; a
  linha do CP e a evolução semanal/mensal são da rede inteira.
- A **meta de Sell-In** (25.314 sugeridas) é menor que a sugestão da Visão geral (32.901) porque cobre só
  os SKUs com meta de compra (82 linhas); a Visão geral cobre todos os SKUs das campanhas.

### 10.4 Performance PDV/Supervisor: só a linha TOTAL é coerente

Na linha TOTAL, pedido médio = 4.816.524,90 ÷ 3.817 = R$ 1.261,86 (igual à Árvore). Nas linhas por PDV
e por supervisor, não:

- as 6 colunas de faixa somam mais que `QTD PEDIDOS` (13707: 4.162 contra 2.505; TOTAL das faixas:
  6.480 contra 3.817 pedidos);
- o `PEDIDO MÉDIO` dessas linhas = receita ÷ soma das faixas (13707: 3.408.405,92 ÷ 4.162 = R$ 818,93),
  e `ITENS POR PEDIDO` também usa esse divisor.

A hipótese mais provável é que as faixas contem cada pedido uma vez por marca (UN) — com 77% dos ativos
multimarca, ~1,7 "faixa" por pedido é plausível —, mas o arquivo não permite confirmar. Decisão: a tela
recalcula o pedido médio como receita ÷ pedidos (13707: R$ 1.360,64; 13706: R$ 1.073,26) e usa as faixas
só como proporção (% acima de R$ 1.000).

Na aba SUPERVISOR, 4 nomes aparecem duas vezes (Jayara, Gessyca, Andressa, Nathalia: o mesmo supervisor
em duas estruturas) e as linhas "13707 -" / "13706 -" são pedidos de estruturas sem supervisor. A tela
numera os repetidos e renomeia essas linhas para "Sem supervisor · PDV …". Contra o extrato, os números
batem com pequena defasagem (Gessica: Extranet 315 pedidos / R$ 1.734.015,43; pedidos não cancelados do
extrato 312 / R$ 1.731.005,49).

### 10.5 Cruzamentos validados no Ciclo 14

| Cruzamento | Valores | Resultado |
|---|---|---|
| Receita Bruta entre relatórios | Performance TOTAL, `ReceitaCanalVD_por_UN`, `ReceitaCanalVD_por_Ciclo`, `Receita_por_Ciclo`, "Venda Direta" de `Receita_por_Canal_UN` e a soma de `Receita_por_Cat_Sub_Mar` (todas as 4 abas): R$ 4.825.066,67 | Bate |
| Performance por UN × `ReceitaCanalVD_por_UN` | BOT 2.468.495,96 + 1.060.010,58 = 3.528.506,54 | Bate (as 4 UNs) |
| Receita GMV entre relatórios VendaDireta | Distribuição CP, Receita por Ciclo, Performance TOTAL: R$ 4.816.524,90; PDVs 3.408.405,92 + 1.408.118,98 | Bate |
| Receita por UN (GMV) | soma 4.816.526 | Bate (arredondado ao real) |
| Receita Bruta × GMV | 4.825.066,67 − 4.816.524,90 = R$ 8.541,77 | Bases diferentes, não somar nem comparar |
| Mix de categorias × GMV | 4.900.896,01 × 4.816.524,90 (+1,75%) | **Não fecha**, apesar de o arquivo declarar GMV |
| Pedidos do extrato × Extranet | 4.787.667,86 (elegíveis, FVC incluído) × Bruta −0,78%; × GMV −0,60% | Dentro de ±1% |
| Faixas de valor × extrato | Extranet 248 / 700 / 924 / 534 / 381 / 1.030; extrato (`ValorPraticado`, não cancelados) 251 / 693 / 915 / 532 / 377 / 1.019 | Próximo (base de valor e corte diferentes) |
| Ativos | Monitoramento, ferramentas digitais, ativas canais digitais e ativas ER: 2.125 | Bate nos 4 |
| Opt-out × Monitoramento | base total 5.654; por PDV 3.779 e 1.875 | Bate |
| Colocação por SKU × Visão geral | 32.901 / 33.784 / 29.300 | Bate |
| Giro VD × Visão geral | 29.300 e 15.817 (colunas com outros nomes) | Bate |
| Base ativa | base total − inícios − reinícios = base ativa em todas as linhas do Monitoramento (por PDV e por supervisor), nos Ciclos 13 e 14 — no CP: 5.654 − 161 − 111 = 5.382 | Bate (define o que a Extranet chama de base ativa) |

### 10.6 Onde cada arquivo aparece no app

| Tela | Arquivos do Ciclo 14 |
|---|---|
| Receita & Metas | Performance por PDV (layout simples), ReceitaCanalVD_por_UN, Receita_por_Ciclo, Receita_por_Cat_Sub_Mar, Receita_por_Canal_UN (o card "Canal Omnichannel VD" vem daqui quando a Performance não traz Omni) |
| **Pedidos & Mix** (nova) | Árvore de Pedidos, Distribuição da Receita, Receita por Ciclo (GMV), Receita por UN (GMV), Performance PDV/Supervisor, Distribuição por categoria |
| Sell-In & Reposição | Visão geral, Giro, Histórico de colocação (por campanha / categoria / PDV + maiores faltas de pedido), Aderência (só PDVs VD), meta de Sell-In por SKU |
| Base & Segmentação | ativas canais digitais / ER, ferramentas digitais por PDV, os 3 de opt-out |
| PDV 360 | Receita GMV, pedidos e pedido médio, mix, canais digitais, ER, opt-out, colocação e aderência do PDV |
| Verificações de qualidade | Todos os cruzamentos da §10.5 rodam automaticamente; meta zerada, mix que não fecha e aderência com lojas aparecem como avisos |

`ReceitaCanalVD_por_Ciclo` é lido e documentado, mas não tem card próprio: só repete a receita e a meta
(zerada) que já estão nos outros relatórios.

### 10.7 Pontos em aberto

1. **Meta PEF do Ciclo 14** — reexportar os 3 relatórios `ReceitaCanalVD_*` depois que a meta for lançada.
2. **Mix de categorias** — confirmar com quem gera o relatório por que o total passa da receita GMV em 1,75%.
3. **Faixas da Performance PDV/Supervisor** — confirmar o que cada faixa conta (§10.4).
4. **"Canais digitais"** — confirmar o que entra nesse conjunto ("ER" já confirmado: Espaço do Revendedor).
5. **Aderência** — pedir à Extranet a versão filtrada só para o canal VD, se existir; hoje a linha do CP e a
   evolução semanal misturam lojas e VD.
