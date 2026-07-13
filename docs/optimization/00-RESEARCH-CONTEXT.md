# 00 — Contexto da pesquisa e do pedido

> Documento de aterrissagem: o que foi pedido, o que a pesquisa afirma, o que ela **não** prova,
> e o que este pacote de auditoria trata como hipótese em vez de fato.

**Auditor:** Claude Fable 5 (Modo A — arquitetura e planejamento)
**Data:** 13/07/2026 · **Commit-base:** `0423528` · **Branch:** `master`

---

## 1. O pedido original (fiel)

O dono construiu o ForgeMMR porque já usava **vários modelos de IA por assinatura** para criar
produtos de software end-to-end, manualmente. Automatizou esse processo e quer levá-lo ao máximo.

Entregas pedidas: (1) análise do repositório; (2) prompts para Codex/Claude Code implementarem
melhorias; (3) pesquisa sobre criação de apps voltados a MRR; (4) avaliação honesta de
viabilidade, saturação, riscos e oportunidades.

### Esclarecimento que muda tudo

> "Eu quero **criar e vender produtos**, não vender a pipeline nem vender uma ferramenta para
> outras pessoas criarem apps."

> "Tenho acesso a muitos tokens de vários modelos de alta qualidade e quero usar essa capacidade
> para **shippar o máximo possível**, buscando MRR com produtos lógicos, úteis e comercializáveis
> — não produzir lixo, clones vazios ou spam."

### Situação econômica (é requisito de arquitetura, não contexto emocional)

O dono está **sem emprego** e trata isto como possível fonte real de renda. Consequência direta
para todo este plano:

- **tempo até receita** é restrição de projeto, não métrica de vaidade;
- quantidade de código ≠ progresso; quantidade de lançamentos ≠ chance de receita;
- o ForgeMMR **não** deve virar produto para terceiros;
- custo de manutenção, distribuição e retenção entram como requisitos, não como "fase 2".

---

## 2. Pesquisa recebida

**Arquivo:** `C:\Users\guibr\Downloads\deep-research-report (20).md` — "Pesquisa aprofundada sobre
o ForgeMMR, otimização do repositório e viabilidade para gerar MRR" (13/07/2026). **Lido na
íntegra.** Não havia outro relatório aplicável no diretório indicado.

### O que a pesquisa afirma (resumo fiel)

**Veredito de viabilidade.** Viável, com distinção: o que está saturado **não** é usar uma
pipeline multi-modelo para criar software — é lançar **apps genéricos de IA para consumidor**,
sem nicho, sem canal e sem retenção. "A fábrica interna faz sentido; o spray-and-pray de apps
rasos, não."

**Diagnóstico do repositório (5 teses).**

| # | Tese da pesquisa | Como este pacote a trata |
|---|---|---|
| 1 | Generalização parcial — scripts/CI presos a `waifu-chat`/`anime-quiz`/`doki-call`/`anime-forge` | **Confirmada** no código (ver `01-FABLE-AUDIT.md`, F-14) |
| 2 | Forte no *ship*, fraca no *learn* — sem billing, analytics, funil, pricing | **Confirmada e agravada**: a coleta não existe, e o P4 pede os dados colados à mão |
| 3 | Roteamento estático, sem aprender com desempenho histórico | **Confirmada como fato**, mas **rejeitada como prioridade** (ver §4) |
| 4 | Segurança permissiva (bypass de permissões, DNS automático) | **Confirmada, com raio de explosão mapeado** (F-11, F-12) |
| 5 | Falta "kernel de MRR" (auth, billing, limites, onboarding, telemetria) | **Parcialmente refutada**: `packages/credits` existe e **é usado** — falta billing real, telemetria durável e auth |

**Fatos de mercado citados** (fonte: ChartMogul, a16z, OECD, Cetic.br/TIC Empresas, Sebrae —
todos via o relatório, **não verificados independentemente por mim**):

- crescimento recorrente mediano de SaaS privado caiu para ~21% (Q1/2025);
- startups AI-native: 3× mais propensas a chegar a US$ 1M ARR em 6 meses, 8× a US$ 10M em 12 —
  **mas <1% chegam lá**; outliers são raros;
- consumidor genérico de IA compete com ChatGPT e com incumbentes (Canva, CapCut, Notion) que
  absorveram IA — tese fraca;
- adoção de IA por PMEs é baixa (11,9% em firmas de 10–49 funcionários vs 40% em 250+) e
  concentrada em **marketing/vendas** e **automação de fluxo com texto no meio**;
- Brasil: adoção de IA em empresas subiu de 13% (2024) para 17% (2025); 76% das MPEs usam
  computador, 47% usam software integrativo;
- **ticket importa**: empresas que miram clientes de US$ 300–2.999/mês crescem 3–5× mais rápido
  que as dos extremos; retenção B2B > retenção B2C de ticket baixo;
- billing mensal cresce mais rápido no começo; anual retém melhor.

**Recomendação central da pesquisa:** usar o Forge como fábrica privada de **uma tese por vez** —
SaaS operacional para pequenas empresas de serviço (captação + follow-up + proposta), ou
intake/workflow documental para serviços profissionais. Evitar: app genérico de IA para
consumidor, copy tool sem nicho, **quiz/advergame como aposta principal de renda recorrente**, e
horizontal tipo CRM/ERP-lite.

---

## 3. Limitações desta base de evidência (leia antes de confiar)

1. **Não verifiquei as fontes de mercado.** Os números acima vêm do relatório. Não abri
   ChartMogul, OECD nem Sebrae. Trate-os como **insumo de direção**, não como dado auditado.
2. **A pesquisa inspecionou o repositório por amostragem** e errou em pelo menos um ponto
   material: afirma que a parte de billing/limites "praticamente não aparece como componente de
   primeira classe". `packages/credits` existe, é completo (free diário + coins + weekly) e **é
   importado por `waifu-chat` e `doki-call`** — o que falta é o PSP (cobrança real), não o kernel
   de créditos. Dois céticos independentes refutaram a versão forte dessa tese.
3. **Cutoff.** O relatório é de 13/07/2026; o mercado de IA muda rápido. Nada aqui depende de um
   número de mercado específico para funcionar.
4. **A pesquisa não é especificação.** Onde ela e o código divergem, o código manda; onde ela e o
   objetivo econômico divergem, o objetivo manda.

---

## 4. Recomendações da pesquisa que este plano **rejeita** (e por quê)

| Recomendação | Decisão | Motivo |
|---|---|---|
| "Scheduler adaptativo que aprende com histórico de desempenho por player/job" | **NÃO FAZER agora** (P3) | 4 apps e ~10 runs não formam base estatística. Antes de um scheduler, é preciso **coletar e agregar** o histórico (Onda 4) — e a agregação sozinha já entrega 90% do valor (saber que o GLM passa em B3 e o Grok não). Um roteador ponderado sobre 10 amostras é superstição com código. |
| "Kernel de MRR completo: auth + billing + limites + onboarding + feature flags + 4 archetypes novos" | **Fatiar** | Construir 4 archetypes de app antes de existir 1 cliente pagante é a "fábrica de lixo" que o dono pediu para evitar. O plano implementa **só** o que o primeiro produto pagante exige: PSP real, telemetria durável e o scorecard que força comprador/canal. |
| "Isolamento por worktree efêmero por job" | **NÃO FAZER** | Já existe isolamento melhor: **repo git por app** (`apps/<app>/.git`), decisão registrada em `docs/system-design-git-control.md`. Worktree por job adiciona custo sem fechar nenhum buraco real. |
| "Trocar o roster manual por scheduling engine orientado por desempenho" | **Adiado (Onda 4)** | Mesmo motivo. Além disso, o gargalo real de autonomia não é *escolher melhor* o player — é que **os times gerados não têm fallback nenhum** (F-06): um rate-limit banal já derruba a pipeline para o humano. |

---

## 5. A distinção que governa o plano inteiro

> **Vender produtos ≠ vender a pipeline.**

O ForgeMMR é **meio de produção**, não produto. Nenhuma tarefa deste pacote existe para tornar o
Forge vendável, documentável para terceiros, extensível por plugins ou "pronto para open source".
Toda tarefa existe para aumentar a probabilidade de **um produto feito por ele ser pago por
alguém**.

Isso reordena a prioridade de forma não-óbvia: um bug que faz o `verify` aceitar trabalho não
feito custa mais caro que um recurso ausente, porque envenena todos os lançamentos futuros. E um
scorecard que não pergunta *quem paga* é mais perigoso que um scorecard ausente — porque dá a
sensação de que a pergunta foi feita.

---

## 6. Hipóteses ainda não verificadas (candidatas a experimento, não a código)

| Hipótese | Como testar barato |
|---|---|
| O nicho B2B/prosumer BR (captação + follow-up para PME de serviço) tem disposição a pagar R$ 100–300/mês | 10 conversas de venda **antes** de qualquer P0. Custo: 0 tokens. |
| Os 3 apps no ar (anime-quiz, anima-deck, doki-call) têm zero tração | Instrumentar e medir 7 dias (Onda 3) — hoje **não há dado**, nem a favor nem contra |
| A capacidade ociosa de assinatura é o gargalo | **Provavelmente falsa.** O gargalo observado é decisão e distribuição, não throughput de código: a fábrica já produziu 4 apps em dias, e nenhum tem receita |

A última linha é a mais importante deste documento: **a fábrica não está lenta. Ela está apontada
para o alvo errado.** Todo o resto do plano decorre disso.
