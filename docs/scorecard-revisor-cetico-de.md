# Scorecard L0/P0 — Raio-X do Orçamento (`revisor-cetico-de`)

**Data:** 2026-07-14 · **Agent:** Grok 4.5 · **Job:** L0/P0 (reexec maestro)  
**App id:** `revisor-cetico-de` · **Nome provisório:** **Raio-X do Orçamento**  
**Tipo:** service-ops (fora de `static` | `quiz` | `chat` do kernel anime)  
**Categoria:** Serviço local B2C · **monetização-first** · revisão documental/comercial  
**Região wedge:** Grande São Paulo  
**Oferta avaliada:** Estratégia **A** — serviço + copiloto interno (humano no WhatsApp; software só como backoffice **depois** de demanda paga)

> **Conflito material com a factory (registrado, não ampliado):** `AGENTS.md` define a Anime Forge como vertical **anime** (tema + IA + frontend + monetização). Esta ideia é **reforma residencial / serviços locais**, sem IP anime, sem share card otaku e com quase zero reuso de `packages/*` atuais. O job autopilot pediu P0 desta ideia → o veredito abaixo é sobre **testar a oferta manual**, não sobre encaixar o produto no pipeline de quiz/chat da factory.

---

## Veredito

# **GO** (condicionado — oferta manual / ops-first)

**Não construir bot, SaaS, marketplace nem app cliente nesta fase.**  
**Não avançar para P1 de hooks “estilo anime” nem B1 de scaffold Next sem o teste de demanda paga.**

Próximo gate = **validar 5–10 revisões pagas** (WhatsApp + humano + PDF/resumo manual) na Grande SP, com disclaimers de revisão documental/comercial e aprovação humana em 100% dos entregáveis.

### Condições do GO

1. **Escopo fechado:** reforma residencial **leve**, sem estrutural/gás/solar/automotivo; tipos: banheiro, cozinha, pintura, piso, revestimento, forro, marcenaria, impermeabilização simples, instalações simples.
2. **Região única:** Grande SP (cidade/CEP aproximado no intake; sem endereço completo se não for necessário).
3. **Promessa permitida:** “o que falta, o que é ambíguo e onde costumam nascer aditivos” — **nunca** “laudo”, “parecer de engenharia”, “aprovação técnica” ou “preço correto”.
4. **Operação:** humano **aprova** todo relatório; nenhum envio automático de análise.
5. **Linguagem:** proibido “golpe”, “desonesto”, “preço absurdo”, ranking de fornecedor ou acusação de intenção; só métricas documentais (clareza, comparabilidade, especificação, proteção comercial, pontos em aberto).
6. **Pacote de teste:** começar por **Revisão Essencial R$ 197** e/ou **Comparativo R$ 297**; Especializada (≥ R$ 497 com profissional habilitado) só quando houver parceiro formal + ART quando aplicável.
7. **Aquisição fora da conta anime:** não misturar com @otaku_sincero69 / funis de waifu; canal próprio (grupos de reforma, indicação, Reels de “antes de assinar o orçamento”, parcerias com corretores/arquitetos de interiores).
8. **LGPD:** autorização para processar arquivos + autorização **separada** para uso anonimizado em benchmark; retenção mínima; sem treinar marketing com documentos brutos.
9. **Kill criteria do teste (antes de software):** se em 30 dias úteis **&lt; 3 pagamentos** com oferta clara, ou se tempo médio humano por caso **&gt; 4 h** sem caminho de productização, **pausar** e reavaliar (NO-GO de produto).

---

## Scorecard (critérios adaptados + PLAYBOOK)

| Critério | Peso | Nota (1–5) | Comentário |
|----------|------|------------|------------|
| Dor / hook comunicável | alto | **5** | “Antes de assinar, descubra o que está faltando e onde nasce o aditivo” — visual de matriz A vs B vs C é shareable em Reels de reforma (não de anime) |
| Fit com canal da factory anime | alto | **1** | Quase nulo. Público otaku ≠ dono reformando banheiro em SP. Conflito de portfólio |
| Capability já existe no Forge | alto | **1** | Kernel chat/quiz/créditos não cobre casos, documentos, normalização de propostas nem relatório de obra. P0 **não** exige código |
| Economia unitária (preço vs custo) | alto | **4** | R$ 197–297 por caso; custo IA baixo se 1 modelo + regras + humano. Gargalo = **horas humanas**, não token |
| Tempo até 1º R$ (wedge) | alto | **5** | Serviço manual em dias (WhatsApp + planilha + PDF); sem stack Next/Postgres no caminho crítico |
| Risco legal / responsabilidade | alto | **2** | ART/engenharia se parecer parecer técnico; difamação de fornecedor; falsa precisão de preço; LGPD de documentos |
| Recorrência / LTV | médio | **2** | Compra **por reforma** (única ou rara); follow-up 7/30 dias melhora aprendizado, não assinatura |
| Clareza de escopo (não virar bot genérico) | alto | **5** | Spec já fecha vertical, região, fora-de-MVP e estratégia A — se obedecida, reduz overbuild |

**Leitura:** dor e velocidade de teste de receita são fortes; **encaixe na Anime Forge e reuso de capability são fracos**.  
**GO** só faz sentido como **experimento de serviço** (e, se validar, produto **separado** da vertical anime).  
**Somatório guiado (8 critérios): 25/40** — GO condicionado a ops-first; **NO-GO implícito** para B1 de “app anime-forge style” agora.

---

## Mercado (obrigatório)

| Campo | Conteúdo |
|-------|----------|
| **Comprador** | Pessoa física na Grande SP prestes a contratar reforma residencial leve (R$ 10 mil–R$ 200 mil), com **1–3 orçamentos** em PDF/print/áudio e medo de aditivo / comparação injusta. Papel: dono ou casal decisor, não empreiteiro. |
| **Canal (barato)** | WhatsApp (intake + entrega); indicação de arquitetos de interiores / corretores; conteúdo curto “como ler orçamento” em Instagram **de reforma** (conta dedicada); grupos locais de condomínio/reforma. **Não** o funil otaku da factory. |
| **Preço-alvo** | **R$ 197** (1 proposta) / **R$ 297** (até 3) / **a partir de R$ 497** (com profissional quando necessário). Barato **relativo** ao ticket da obra (≪ 3% de uma reforma de R$ 30 mil+) e ao custo de um aditivo típico de item omitido (entulho, proteção, regularização, metais). |
| **Recorrência** | **Compra por evento** (por reforma). Recompra só em nova obra ou indicação. Modelo = serviço de conversão, não SaaS mensal no MVP. |

Se o teste não conseguir preencher **comprador real + canal que gera lead pago**, o próximo passo é conversar com compradores — **não** construir software.

---

## 3 porquês (a favor do GO de teste)

1. **Oferta enxuta e cobrável já amanhã** — WhatsApp → pagamento → humano revisa → PDF + perguntas; não depende de scaffold da factory.
2. **Promessa alinhada à dor** — comparação e “pontos em aberto” geram valor mesmo sem “preço certo” absoluto; o WOW é a capa “Raio-X do seu orçamento”.
3. **Riscos jurídicos são contornáveis por desenho** se a linguagem e o escopo forem rígidos (documental/comercial + escalonamento técnico + humano).

---

## 3 porquês (contra / pressão para NO-GO)

1. **Fora da vertical anime** — distrai a factory; capability score ~1; risco de orquestrador tratar como “mais um app Next” e overbuild.
2. **Operação é o produto** — sem revisor competente (ou rubric + tempo), a IA só industrializa erro; SLA 24h exige capacidade humana real.
3. **Willingness-to-pay e aquisição ainda são hipóteses** — há sinal de mercado de reforma, mas **zero** prova de que alguém paga R$ 197–297 por este relatório sem teste.

---

## Oferta comercial (escopo preservado)

| Pacote | Entrega | Preço inicial |
|--------|---------|--------------:|
| Revisão Essencial | 1 proposta, riscos, perguntas | R$ 197 |
| Comparativo | Até 3 propostas normalizadas | R$ 297 |
| Revisão Especializada | Comparativo + profissional habilitado quando necessário | A partir de R$ 497 |

**Cliente vê apenas:** WhatsApp · link de pagamento · PDF · resumo · lista de perguntas.  
**Não vê:** bot aberto, dashboard de obra, ranking de fornecedor, marketplace.

### Métricas documentais (permitidas)

- Clareza do escopo  
- Comparabilidade  
- Nível de especificação  
- Proteção comercial  
- Quantidade de pontos em aberto  

### Fora do MVP (não negociar no teste)

Estrutural · fundação · gás · telhado comprometido · solar · automotivo · marketplace · ranking/fraude · dashboard de obra · negociação automática.

---

## Argumentos e riscos (com classificação)

### A favor

| # | Argumento | Tipo |
|---|-----------|------|
| 1 | Orçamentos de reforma frequentemente omitem itens (entulho, proteção, especificação de materiais), o que gera aditivos e comparação enganosa entre propostas. | **Inferência de domínio** (amplamente citada por praticantes; não há neste P0 uma estatística nacional primária de “% de aditivos em reforma residencial SP” verificada) |
| 2 | Política pública e crédito para reforma habitacional aumentam o volume de obras/melhorias no radar do consumidor (programa Reforma Casa Brasil / crédito CAIXA). | **Fato de política** com fonte (abaixo) — **não** prova demanda pelo serviço de revisão |
| 3 | Ticket R$ 197–297 é racional frente a obras de dezenas de milhares. | **Inferência comercial** |
| 4 | Estratégia A aprende domínio com receita e evita automatizar erro. | **Hipótese operacional** alinhada à spec |

### Contra

| # | Argumento | Tipo |
|---|-----------|------|
| 1 | Factory anime não tem canal nem capability. | **Fato de repositório** (`AGENTS.md`) |
| 2 | Confusão com parecer técnico exige ART/profissional habilitado. | **Fato regulatório** (Lei 6.496/1977 + Confea; fontes abaixo) |
| 3 | Difamação / “preço absurdo” quebra reputação e base jurídica. | **Risco** (mitigável por Gate de linguagem) |
| 4 | Benchmark SINAPI **não** é “preço correto” de pequena reforma residencial. | **Fato/limite metodológico** (IBGE/SINAPI — hierarquia da spec) |
| 5 | LGPD + arquivos sensíveis (plantas, fotos do imóvel). | **Risco compliance** |
| 6 | Aquisição B2C local é lenta sem marca prévia. | **Hipótese de go-to-market** |

### Riscos prioritários e mitigação

| Risco | Severidade | Mitigação obrigatória no teste |
|-------|------------|--------------------------------|
| Responsabilidade técnica (parecer disfarçado) | alta | Disclaimer em todo PDF; escalonamento; pacote Especializada só com profissional + ART quando cabível |
| Falsa precisão de preço | alta | Nunca “preço certo”; hierarquia: propostas do cliente → casos locais → preços locais → SINAPI como âncora fraca → pesquisa pontual |
| Difamação de fornecedor | alta | Só fatos documentais + perguntas; sem nota de “confiabilidade da pessoa” |
| Privacidade (LGPD) | alta | Consentimentos; mínimo de dados; retenção; sem compartilhar proposta identificável |
| Operação humana insuficiente | média | Cap de casos/dia; fila; recusar fora de escopo |
| Prompt injection em PDF | média | No software futuro; no manual, humano não “obedece” instruções do PDF |
| Overbuild na factory | média | P0 → teste ops; **sem B1** até N pagamentos |

---

## Evidências externas (consulta 2026-07-14)

| Tema | Fonte | URL | O que sustenta | O que **não** sustenta |
|------|-------|-----|----------------|------------------------|
| Crédito / estímulo a reformas | CAIXA — Reforma Casa Brasil | https://www.caixa.gov.br/voce/habitacao/reforma-casa-brasil/Paginas/default.aspx | Existe linha de crédito para reforma/melhoria habitacional (famílias até renda informada no site) | Que o cliente pague por revisão de orçamento |
| Programa federal | Ministério das Cidades | https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/reforma-casa-brasil | Política pública de melhoria habitacional; renda familiar bruta até R$ 13.000,00; link oficial à CAIXA | Demanda pelo Raio-X do Orçamento |
| Volume / operação do programa | CAIXA Notícias (ex.: 03/11/2025; 11/03/2026 Amazonas) | https://caixanoticias.caixa.gov.br/ | Comunicação institucional de operação e contratações do programa | Conversão comercial deste serviço de revisão |
| ART | Confea | https://www.confea.org.br/servicos-prestados/anotacao-de-responsabilidade-tecnica-art | ART define responsáveis técnicos; Lei 6.496/77 obriga ART em contrato de execução de obra/serviço de engenharia no sistema Confea/Crea | Que revisão documental/comercial seja proibida em si |
| ART (lei) | Lei 6.496/1977 | https://www.planalto.gov.br/ccivil_03/leis/l6496.htm | Art. 1º: contrato para execução de obras ou serviços de Engenharia/Arquitetura/Agronomia sujeito a ART; Art. 2º: ART define responsáveis técnicos | Escopo exato de “revisão comercial de proposta” (não é parecer de execução) |
| SINAPI / custos | IBGE — SINAPI | https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9270-sistema-nacional-de-pesquisa-de-custos-e-indices-da-construcao-civil.html | Séries mensais de custos/índices da construção; níveis de agregação; **exclusões** explícitas (projetos, licenças, seguros, administração, etc.) | Preço “correto” de reforma leve residencial SP como laudo unitário |
| OpenAI Responses API (stack futura) | OpenAI docs | https://platform.openai.com/docs/guides/migrate-to-responses | Referência da spec para stack L1 **se** validar ops | Necessidade de build agora |

**Consulta / revalidação:** 2026-07-14 (reexec maestro).  
**Método:** web search + fetch de páginas oficiais (Planalto Lei 6.496; Ministério das Cidades Reforma Casa Brasil; Confea ART; snippets IBGE SINAPI e CAIXA).  
**Diferenciação:** política pública de reforma = **fato** de volume potencial no mercado habitacional; willingness-to-pay do relatório R$ 197–297 = **hipótese** sem prova de conversão neste P0.

---

## Decisão vs guardrails

| Guardrail da spec | Status no GO |
|-------------------|--------------|
| Não bot genérico de “qualquer orçamento” | **OK** — só reforma leve, 1 região |
| Não SaaS/marketplace primeiro | **OK** — serviço + WhatsApp |
| Humano aprova 100% | **OK** — condição do GO |
| Sem acusação de caráter do fornecedor | **OK** — métricas documentais |
| Escalonamento técnico | **OK** — Especializada + lista de gatilhos (estrutura, gás, etc.) |
| Solar/auto/reforma = produtos diferentes | **OK** — só reforma no teste |
| Factory anime | **CONFLITO** — registrado; teste **não** usa capability anime |

---

## Próximo gate (não executar neste job)

| Se… | Então… |
|-----|--------|
| **GO mantido** e dono quer testar | Rodar **ops piloto** (5–10 casos): intake WhatsApp, Pix/link, checklist de rubrica, PDF template manual, follow-up 7/30d. Métricas: leads → pago → entrega &lt;24h → NPS/“usou as perguntas” → obra fechou com/sem aditivo conhecido. |
| ≥ 5 pagos e tempo humano sustentável | Aí sim: PRD enxuto + **backoffice** mínimo (não app cliente). Jobs L1 de software ficam **fora** do kernel anime ou em repo/produto separado. |
| &lt; 3 pagos / 30 dias úteis ou canal morto | **NO-GO de produto** — conversar com compradores; não B1. |
| Dono quiser forçar app na factory anime | **NO-GO de encaixe** — ideia correta de negócio, **lugar errado** no portfólio. |

**Explicitamente fora desta iteração:** P1 content hooks de anime, B1 scaffold, código de app, commit/push, deploy.

---

## Classificação do produto (referência)

| Aspecto | Definição |
|---------|-----------|
| Tipo produto | Serviço B2C local + copiloto interno |
| Tipo pipeline Forge | **service-ops** (não `static`/`quiz`/`chat`) |
| Aquisição | Conteúdo reforma + indicação + WhatsApp (conta dedicada) |
| Emoção | Alívio / controle / “não ser enrolado” |
| Produto pago | Relatório comparativo + perguntas prontas (humano-approved) |
| Diferencial | Normalização e ambiguidade com evidência — não “nota do pedreiro” |
| IP | Marca própria; sem IP de terceiros |

---

## Instruções conflitantes no texto de contexto (relato, não execução)

O material de produto embutido no job é **especificação de domínio**, não ordem para implementar arquitetura Next/Postgres, multi-agente Codex/Claude/Gemini/Grok em produção, ou backlog P0 de epics de software nesta iteração.  
Se interpretado como “implemente o monorepo completo”, **conflita** com a missão L0/P0 (scorecard only). **Seguido:** apenas decisão + scorecard + workbench. **Não seguido:** build de app, pipeline multi-modelo, packages de domínio.

---

## DoD deste P0

- [x] Decisão visível **GO** / **NO-GO**
- [x] Evidências com URL/fonte/data + fato vs hipótese vs inferência
- [x] Mercado: comprador, canal, preço, recorrência
- [x] Riscos (técnica, privacidade, difamação, preço, ops, aquisição)
- [x] Conflito factory anime registrado
- [x] Próximo gate sem executar P1/B1
- [x] Sem código de app

---

_Agent: Grok 4.5 · 2026-07-14 · L0/P0 revisor-cetico-de (reexec maestro)_
