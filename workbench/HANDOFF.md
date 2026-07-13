# HANDOFF

## Loop ativo
**L1** — DOKI//CALL (`doki-call`) — **B4 Wire API DONE** · próximo = B5 ship check  
*(slug legado `o-anima-deck` superado — canônico = `doki-call`)*

## Last agent
Grok 4.5 (ggg-grok1) | 2026-07-13 · L1/B4 wire API doki-call

## Last iteration — L1/B4 doki-call (2026-07-13)
- **Job:** L1/B4 wire chat AI + TTS + entitlement/checkout stub
- **Entrega:** `POST /api/chat` (@forge/ai + cookie free quota 3 → 402); `GET /api/credits`; `POST /api/tts` (1/dia + browser speech); `POST /api/checkout` stub → entitlement server; `GET /api/entitlement`; `POST /api/voice/session` com `assertCallAllowed`; UI free chat → API real + fallback mock; paywall → checkout → call_stub
- **VERIFY:** `npm run build -w @forge/doki-call` **EXIT 0**
- **Sem git** (orquestrador) · Realtime live / PSP real = ship (não B4)
- **Próximo:** B5 ship check (health + free path + paywall CTA)

## Iteration anterior — L1/B2 doki-call (2026-07-13)
- **Job:** L1/B2 personas pack (`content/personas/doki-pack-v2.json`)
- **Entrega:** 3 OCs 21+ (Mika/Rena/Yuki) com system prompts densos p/ telefone+guardrails IP/idade; starters PT+EN; tags voz; `app.config` → v2; voice-note free path por persona em `mock-chat.ts`
- **VERIFY:** `npm run build -w @forge/doki-call` **EXIT 0**
- **Sem git** (orquestrador) · v1 mantido no repo (histórico)
- **Próximo:** B3 prompt GLM denso (Neon Y2K) OU B4 chat AI + TTS + entitlement

## Iteration anterior — L1/B1 doki-call (2026-07-13)
- **Job:** L1/B1 scaffold app (`@forge/doki-call`)
- **Entrega:** funil create→free_text(3)→voice_note→paywall R$4,90→fake-door+lead; 3 personas originais 21+; i18n PT+EN; age gate After Dark; `RealtimeVoiceProvider` stub; API health/telemetry/interest/voice/session (402 sem entitlement); tokens Neon Y2K (`--af-*`)
- **VERIFY:** `npm run build -w @forge/doki-call` **EXIT 0**
- **Sem git** (orquestrador) · **Sem Realtime/checkout real** (B4)
- **Próximo:** B3 prompt GLM denso OU B4 chat AI + TTS + entitlement

## Iteration anterior — L0/P1 doki-call (2026-07-13)
- **Job:** L0/P1 content hooks + brief fake-door
- **Artefato:** `apps/doki-call/docs/content-hooks.md`
- **Entrega:** 15 hooks PT-BR+EN (SFW); copy paywall R$ 4,90; brief fake-door (mock criação + áudio pré + CTA → “em breve” + lead); telemetria `visit→…→audio_play→buy_click`; métrica norte **áudio→clique Atender**
- **Sem código de app** · **Sem Realtime/checkout** · **Sem git** (orquestrador)

## Iteration anterior — DS-GEN doki-call (2026-07-13)
- **Job:** DS-GEN (gate `ds-pick`) · 3 propostas visuais · `maestro/proposals/doki-call/proposal-{1,2,3}.html` + `apps/doki-call/docs/design-system.md`
- **Pendente do dono:** escolher direção visual 1/2/3

## Iteration anterior — FOUNDATION doki-call (2026-07-13)
- **Job:** FOUNDATION (contrato de arquitetura)
- **Artefato:** `apps/doki-call/docs/system-design.md`
- **Decisões-chave:** Next server (Vercel); free = texto+TTS; Realtime só pós-pagamento; `RealtimeVoiceProvider` (xAI primário, OpenAI fallback); guest + entitlement server-side; 1ª oferta só R$ 4,90; +18 opcional; P1 fake-door antes de B1 voice
- **Sem código de app** neste job

## Iteration anterior — L0/P0 doki-call (2026-07-13)
- **Veredito:** GO condicionado — content-first + fake-door
- **Tipo:** `chat` (produto = server/Realtime+checkout; P1 = hooks/fake-door sem código Realtime)
- **Score:** 27/35 (hook/fit/impulso 5; capability 3; economia 4; MVP 3; risco legal/idade 2)
- **Artefatos:** `apps/doki-call/docs/scorecard.md` · espelho `docs/scorecard-doki-call.md`
- **Portfólio:** 1ª aposta monetização-first; ANIMA//DECK = engagement/share-first
- **Sem código de app** neste job

## Handoff canônico (ideia + o que foi feito)
**Ler primeiro:** `docs/HANDOFF-SESSAO.md` · **Autopilot:** `docs/MAESTRO.md` § Forge Autopilot

## Last iteration — FORGE AUTOPILOT (2026-07-10)
- **Motor**: `maestro/engine.mjs` — pipeline ideia→P0→gate→P1→B1..B5→gate→ship com git
  checkpoints/rollback, retry ≤3, L2 automático em rate-limit (cooldown+fallback do team)
- **CLI**: `npm run forge -- new "<ideia>" --team grok-glm-front` → TUI full-screen
  (gates com teclas g/k/r/f); `forge decide|status|attach|stop|resume|roster`
- **Teams**: grok-solo · grok-glm-front (GLM headless no B3 — fim do copiar prompt) ·
  quality (Opus+Codex review) · dry-run
- **Fix histórico**: Grok headless = `grok -p` (posicional abria TUI → hang/ANSI). Smokes
  reais PASS: GLM-FORGE-OK, GROK-ADAPTER-OK. Dry-run E2E 2× PASS.
- **Deploy**: cf-pages → `<app>.gbbragadev.com` implementado; ⚠ CLOUDFLARE_API_TOKEN é
  read-only → gate entrega 3 passos p/ trocar por token com Pages:Edit + DNS:Edit

## Done (produto)
| App | Status |
|-----|--------|
| **waifu-chat** | MVP + smoke OpenRouter + UI B3 GLM |
| **anime-quiz** | P0→B5 + **live** https://gbbragadev.github.io/anime-forge/ |
| **anima-deck** | ship/iterate em curso (engagement/share-first) |
| **doki-call** | L0/P0–P1 + FOUNDATION + B1–B3 + **B4 wire API** (chat/TTS/entitlement stub) · próximo B5 |

## Done (harness)
- Loops L0/L1/L2 multi-sub (Claude/Codex/Grok/Gemini + GLM B3)
- workbench QUEUE/HANDOFF/CLAIMS
- Guia visual, PLAYBOOK, ship matrix, content-first gates
- OpenRouter: `OPEN_ROUTER_API_KEY` env sistema (não pedir no chat)

## Next
1. **L1/B5** doki-call: ship check (health + free path + paywall CTA)
2. **Content:** postar hooks batch 1,2,3,5,8 + medir `audio_play→buy_click`
3. **Humano P4** anime-quiz / anima-deck measure
4. **Token CF** Pages:Edit + DNS:Edit; Vercel + PSP real quando ship server doki-call
5. **Realtime live** xAI/OpenAI quando keys + VOICE_PROVIDER no ship

## Blockers
- P4 measure = humano
- Deploy automático cf-pages = token CF read-only (3 passos no gate)
- Vercel server deploy = token (necessário quando L1 chat/Realtime do doki-call)

## Links
- Scorecard doki-call: `apps/doki-call/docs/scorecard.md`
- System design doki-call: `apps/doki-call/docs/system-design.md`
- Content hooks doki-call: `apps/doki-call/docs/content-hooks.md`
- Handoff sessão: `docs/HANDOFF-SESSAO.md`
- Quiz: https://gbbragadev.github.io/anime-forge/
- Repo: https://github.com/gbbragadev/anime-forge
- Pipeline: `docs/AGENT-PIPELINE.md`
- Trocar ideia: `docs/PLAYBOOK.md` + `docs/prompts/L0-NOVA-IDEIA.md`

<!-- forge:begin:o-anima-deck -->
## Forge autopilot — o-anima-deck
- **Ideia:** O ANIMA//DECK ficou dividido corretamente em duas camadas:

Visão completa: criação por IA/selfie, packs, inventário, raridades,
evolução, temporadas e Álbum Vivo. Wedge v0: criador estático de
personagem e photocard, sem backend, conta, pagamento ou geração por IA,
feito especificamente para medir criação e compartilhamento.

O próximo produto pode repetir essa lógica:

uma visão completa de companion altamente personalizável; um v0
extremamente focado em provar que alguém paga para receber uma ligação.
Próxima aposta: DOKI//CALL

Crie sua waifu original, defina a personalidade dela e receba uma
ligação em tempo real.

Classificação Aspecto Definição Tipo Híbrido, mas monetização-first
Aquisição Reel, Story e demonstração da voz Emoção Curiosidade, romance,
exclusividade e personalização Produto pago Ligação ao vivo com a
personagem criada Diferencial Não é só chat de texto: é uma personagem
que fala, reage e lembra IP Personagens e vozes originais Veredito
inicial GO condicionado --- content-first

O ponto mais importante é este:

O usuário não deve pagar apenas pelo "+18". Ele deve pagar pela ligação,
memória e personalização.

O modo adulto deve ser uma camada opcional. Assim, o produto continua
monetizável mesmo se um provedor restringir conteúdo explícito ou mudar
sua política.

A estratégia de compra por impulso

A melhor oferta não é "assine um chatbot". Isso exige confiança demais.

A oferta deve ser:

"Atender uma ligação de cinco minutos da personagem que você acabou de
criar."

Funil recomendado Etapa Experiência Objetivo psicológico 1. Hook Reel
mostrando uma chamada chegando Curiosidade 2. Criação Nome,
personalidade, relação, voz e intensidade Sensação de propriedade 3.
Prova gratuita Três mensagens de texto Demonstrar personalidade 4.
Momento de presença Um áudio curto usando o nome do usuário Demonstrar
que ela "existe" 5. Paywall "Atender ligação ao vivo --- 5 minutos por
R\$ 4,90" Compra pequena e concreta 6. Entrega Chamada começa
imediatamente após o pagamento Recompensa instantânea 7. Upsell Mais
minutos, memória persistente ou áudio exclusivo Aumentar ticket

A etapa gratuita pode usar texto + uma mensagem curta por TTS, deixando
o Realtime reservado para clientes pagantes. Isso reduz drasticamente o
custo de usuários que entram apenas por curiosidade.

Copy principal do paywall SUA PERSONAGEM ESTÁ PRONTA

Ela já sabe seu nome, sua personalidade e o que você acabou de contar.

Atender ligação ao vivo 5 minutos · R\$ 4,90

\[ ATENDER AGORA \]

Abaixo do botão:

Pagamento único. Sem assinatura. A conversa continua do ponto em que
parou.

Isso é mais forte que vender "créditos" logo no primeiro contato. O
usuário entende exatamente o que está comprando.

Estrutura de ofertas

A primeira tela deve mostrar somente a oferta de R\$ 4,90. Mais opções
aparecem depois do clique ou após a primeira chamada.

Oferta Entrega Preço proposto Custo bruto de voz na xAI Degustação
Texto + áudio curto Grátis TTS, sem Realtime Primeira Ligação 5 minutos
ao vivo R\$ 4,90 US\$ 0,25 Encontro Privado 12 minutos + memória R\$
9,90 US\$ 0,60 Passe da Noite 30 minutos + memória por 7 dias R\$ 19,90
US\$ 1,50

Esses custos de voz são calculados pela tarifa atual publicada de US\$ 3
por hora para o agente de voz da xAI, antes de câmbio, impostos,
infraestrutura e taxa do meio de pagamento. A xAI também publica TTS por
caractere, o que torna uma mensagem de voz curta mais apropriada para a
degustação gratuita.

Melhor order bump

Depois que o usuário escolher a primeira ligação:

Adicionar áudio personalizado para guardar "Boa noite, \[nome\]"

-   R\$ 2,90

É um produto digital instantâneo, pessoal e emocional. Também pode ser
baixado e enviado em grupos, gerando tráfego orgânico.

A experiência de personalização

O usuário não precisa construir uma personagem visual inteira no v0.
Isso aumentaria demais o escopo.

Personalização mínima 1. Identidade Nome da personagem; nome pelo qual
ela chama o usuário; idade da personagem, sempre explicitamente 21+;
pronome; relação inicial. 2. Personalidade

Escolha uma personalidade principal:

provocadora; carinhosa; sarcástica; dominante; misteriosa; caótica.

E um traço secundário:

ciumenta; protetora; competitiva; tímida; confiante; dramática. 3.
Cenário primeira ligação; encontro virtual; rivalidade; missão secreta;
reencontro; conversa de madrugada. 4. Voz

No v0, usar entre três e cinco vozes prontas:

suave; energética; elegante; misteriosa; confiante.

A xAI documenta vozes prontas com diferentes tons, suporte a conversa
speech-to-speech de baixa latência e também vozes customizadas. Para o
MVP, as vozes prontas são preferíveis; clonagem de voz só deveria entrar
com contrato e consentimento explícito de uma atriz de voz.

5.  Intensidade ○ Amigável ○ Romântica ○ Provocadora ○ After Dark 18+

O modo adulto não deve aparecer antes da confirmação de idade.

Como o "+18" deve funcionar

Há uma diferença importante entre:

romance; flerte; linguagem sugestiva; roleplay adulto; conteúdo sexual
gráfico.

Nenhuma das páginas oficiais consultadas concede uma autorização
irrestrita para erotismo explícito em aplicações comerciais. Portanto, o
app precisa tratar essa capacidade como configurável por provedor, não
como promessa fixa do produto.

As políticas atuais da OpenAI proíbem conteúdo íntimo não consensual,
violência sexual, sexualização de menores, roleplay sexual com menores e
uso indevido da voz ou imagem de terceiros. A política atual da xAI
também proíbe sexualização de crianças, nudificação ou representação
pornográfica de pessoas reais, personificação enganosa e serviços pagos
que ofereçam outputs violadores.

Regras obrigatórias Todas as personagens têm 21 anos ou mais. Nenhum
arquétipo pode parecer escolar ou menor de idade no modo adulto. Nenhum
personagem, nome, roupa, voz ou história de anime existente. Não
permitir clonagem de dubladores, celebridades ou pessoas reais.
Aquisição no Instagram permanece SFW. O modo adulto fica em rota
separada e atrás de age gate. O usuário pode definir limites e tópicos
proibidos. O app precisa ter saída imediata da conversa e exclusão do
histórico. O conteúdo básico continua funcionando sem modo adulto.

Isso é especialmente relevante porque a descrição atual do público do
ANIMA//DECK inclui usuários de 16 a 28 anos. O produto adulto não pode
assumir que toda a audiência proveniente da página é maior de idade.

OpenAI Realtime versus Grok Voice Minha recomendação para o MVP: xAI
como primário, interface abstrata desde o início Critério xAI/Grok Voice
OpenAI Realtime Cobrança US\$ 3 por hora Por tokens de áudio
Previsibilidade de margem Alta Média Conversa speech-to-speech Sim Sim
Cliente seguro Tokens efêmeros Credenciais efêmeras Browser
WebSocket/WebRTC demonstrado WebRTC recomendado Vozes prontas Sim Sim
Voz customizada documentada Sim Não usaria no v0 Certeza sobre erotismo
explícito Não Não Uso recomendado Voz principal do MVP Fallback e modo
SFW

A xAI documenta o grok-voice-latest como speech-to-speech em tempo real,
com latência inferior a um segundo, endpoint Realtime e tokens efêmeros
para clientes.

A OpenAI também possui arquitetura apropriada para browser: sessões
Realtime, comunicação por WebRTC, credenciais efêmeras e modelos
gpt-realtime-2.1 e gpt-realtime-2.1-mini. Atualmente, o modelo mini
publica valores de US\$ 10 por milhão de tokens de áudio de entrada e
US\$ 20 por milhão de saída; a versão completa publica US\$ 32 e US\$
64, respectivamente.

A aplicação deve ter uma interface como:

interface RealtimeVoiceProvider { createSession(input:
VoiceSessionInput): Promise`<VoiceSession>`{=html};
endSession(sessionId: string): Promise`<void>`{=html};
getUsage(sessionId: string): Promise`<VoiceUsage>`{=html};
supportsMode(mode: "safe" \| "romantic" \| "mature"): boolean; }

Isso impede que uma mudança de preço, disponibilidade ou política mate o
produto inteiro.

Escopo fechado do v0 Incluir três personagens originais; seis
combinações de personalidade; três vozes; nome do usuário; texto
gratuito limitado; uma mensagem de voz curta; ligação Realtime paga;
oferta única de R\$ 4,90; pagamento Pix/cartão; sessão convidada, sem
cadastro obrigatório antes da compra; contexto preservado após
pagamento; limite de minutos controlado no servidor; telemetria do
funil; age gate; moderação básica; histórico temporário; botão
compartilhar resultado SFW. Não incluir geração de avatar por IA; upload
de selfie; clonagem de voz pelo usuário; dezenas de personagens;
inventário; gamificação complexa; feed social; assinatura recorrente na
primeira versão; relacionamento com níveis; conteúdo adulto gráfico como
requisito do lançamento. Hooks para Instagram

Todos funcionam sem anunciar conteúdo explícito:

Hook 1

"Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Hook 2

"Escolhi 'sarcástica + ciumenta' e ela falou meu nome..."

Hook 3

"Esse site cria uma personagem e faz ela te ligar de verdade."

Hook 4

"Não coloque 'dominante' e 'caótica' ao mesmo tempo."

Hook 5

"A conversa era normal até ela mandar esse áudio."

O Reel termina com a tela:

CRIE A SUA link na bio Teste antes do desenvolvimento

Antes do Realtime completo, o P1 pode testar intenção de compra com:

mockup funcional da criação; áudio pré-gerado usando uma personagem
original; botão Atender ligação --- R\$ 4,90; após o clique, tela
transparente de "lançamento em breve" e captura de interesse.

Métricas principais:

visita → início da criação início → personagem concluída personagem →
reprodução do áudio áudio → clique em comprar clique → pagamento
pagamento → segunda compra

A métrica mais importante não é tempo de chat. É:

Quantas pessoas que ouviram a mensagem personalizada clicaram para
atender a ligação?

Scorecard inicial Critério Nota Hook demonstrável em um Reel 5/5 Fit com
audiência otaku 5/5 Potencial de compra por impulso 5/5 Capability já
existente no Anime Forge 3/5 Economia de API 4/5 Velocidade do MVP 3/5
Risco de política, idade e distribuição 2/5 Total 27/35 Decisão

GO condicionado.

Condições:

aquisição SFW; personagens sempre adultas e originais; chamada como
objeto principal da compra; modo adulto desacoplado do produto; xAI como
primeiro teste econômico; provider abstraction desde o início; P1 de
conteúdo e fake-door antes do build completo. Bloco pronto para o Anime
Forge --- L0/P0 IDEIA:

Nome provisório: DOKI//CALL

Webapp mobile-first no qual o usuário cria uma waifu original e adulta,
escolhendo nome, personalidade, relação, cenário e voz.

Depois da personalização, recebe: - 3 mensagens de texto gratuitas; - 1
mensagem de voz curta usando seu nome; - oferta para atender uma ligação
speech-to-speech em tempo real.

Oferta principal: "Ligação ao vivo de 5 minutos --- R\$ 4,90" Pagamento
único, preferencialmente Pix/cartão, entrega imediata e sem cadastro
obrigatório antes da compra.

Categoria: Híbrido, monetização-first.

Hook: "Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Capability: - chat existente; - adicionar capability realtime-voice; -
provider abstraction; - xAI/Grok Voice como candidato primário; - OpenAI
Realtime como fallback.

Escopo do v0: - 3 personagens originais; - 6 personalidades; - 3
vozes; - texto gratuito limitado; - voice note TTS; - ligação Realtime
paga; - memória somente durante a sessão; - telemetria; - checkout; -
age gate; - moderação.

Modo +18: - não é requisito para monetização; - somente para usuários
verificados como adultos; - personagens explicitamente 21+; - sem
personagens escolares ou minor-coded; - sem pessoas reais, celebridades,
dubladores ou franquias; - implementar apenas se o provedor e o
processador de pagamento permitirem; - aquisição e conteúdo
compartilhável permanecem SFW.

Fora do v0: - avatar por IA; - selfie; - clonagem de voz pelo usuário; -
assinatura; - inventário; - níveis de relacionamento; - comunidade; -
dezenas de personagens.

Objetivo do P0: Avaliar hook, intenção de compra, custo por chamada,
risco de política, risco de idade, fit com Instagram e tempo de
implementação.

Resultado esperado: GO condicionado a P1 content-first e teste de clique
no CTA de R\$ 4,90.

Este conceito deve ser registrado como a primeira aposta
monetização-first do portfólio, enquanto o ANIMA//DECK permanece como
aposta engagement/share-first.
- **Team:** grok-solo · **Status:** killed
- **Job atual:** — (2/9)
- **Branch:** pipeline/o-anima-deck · checkpoints: 2
- pipeline encerrada: killed
_Atualizado 2026-07-13T00:16:12.372Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/o-anima-deck.json_
<!-- forge:end:o-anima-deck -->

<!-- forge:begin:anima-deck -->
## Forge autopilot — anima-deck
- **Ideia:** feedback fb1: Revise o app como um todo, leve ele a um nivel superior
- **Team:** opussonnet · **Status:** done
- **Job atual:** — (4/3)
- **Branch:** pipeline/anima-deck-fb1 · checkpoints: 1
- **URL:** https://anima-deck.gbbragadev.com
- DONE. Próximo: P4 measure (humano, 5–7d) — postar hooks de apps/anima-deck/docs/content-hooks.md
_Atualizado 2026-07-13T03:08:40.019Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/anima-deck.json_
<!-- forge:end:anima-deck -->

## Last iteration — L1/B5 ship check anima-deck (2026-07-13 · Claude Opus, opussonnet-claude2)
- **1 quebra REAL corrigida:** o texto de share mandava todo mundo pra `deck.gbbragadev.com` (link morto) — o deploy real é **`anima-deck.gbbragadev.com`** (`maestro/pipelines/anima-deck.json`: subdomain+baseUrl). Num app share-first isso vazava 100% do tráfego de volta. Fix em `AnimaDeckApp.tsx:328`; bundle agora só contém o domínio certo. ⚠ **O HANDOFF antigo (iter 1) tem a prosa errada `deck.gbbragadev.com` — não reintroduzir.**
- **Checklist B5:** build EXIT 0 · disclaimer PT no HTML + EN no bundle · selo @otaku_sincero69 · core smoke PASS (pesos raridade=100, fronteiras de `rollRarity` corretas, card coerente, 12 personas bilíngues, 216 combos) · API/paywall = **N-A** (static, sem créditos/backend).
- **Docs:** `.env.example` agora documenta anima-deck (static, sem key, **porta dev 3002**) + root `npm run dev:deck` / `build:deck` (era o único app sem atalho).
- **Não construí:** `og.png` (`seo.ogImage` aponta p/ arquivo inexistente, mas o metadata NÃO referencia → sem 404; share primário manda o PNG do card, não preview de link) → backlog.
- **Sem git** (orquestrador). **Próximo:** gate humano `iterate-visual` segue pendente → `forge decide iterate-visual go|kill`, depois P3 deploy cf-pages (token CF ainda read-only).

## Iteration anterior — FEEDBACK fb1 iter 3 anima-deck (2026-07-12 · GLM ITERATE, skill /frontend-fable)
Gate do dono desta rodada: *"Aumentar a variedade de personas tipo cabeça corpo e tal"*.
- **Gap fechado = "corpo"**: a silhueta de ombros/busto era um path FIXO em `AvatarSvg` (zero variação de corpo). Nova dimensão **`body`** (sleek/atlético/robusto) via `bodyBuild(body)` → 3 silhuetas com largura de ombro 40/52/64px.
- **Variedade multiplicada**: +face `round`, +cabelos `twin`(rabo duplo)/`ponytail`, +3 builds de corpo → **36 → 216 personagens visuais distintos** (4 face × 6 cabelo × 3 olho × 3 corpo). Botão **Aleatório** agora sorteia `body` também (`randomDraft`).
- **Fidelidade preview↔export (guardrail)**: `Photocard` passa `body={card.body}` → card na tela e PNG baixado/share saem com o MESMO corpo (sem isso o export caía p/ default).
- **YAGNI**: fonte Unbounded (iter 2) intocada — feedback de "fonte fina" já estava resolvido. `body` entrou no step 1 (Aparência), não como step novo → `STEPS=6`/progress/validação preservados. Bilíngue PT/EN (labels em `forge.ts` Opt + `i18n.ts` field).
- **VERIFY**: `npm run build -w @forge/anima-deck` **EXIT 0** (types+lint OK). ⚠ verify visual (browser real) pendente no gate humano — confirmar leitura das 3 silhuetas + cabelos novos no preview `iterate-visual`.
Próximo: humano valida no preview (forge decide iterate-visual go|kill). Não rodei git (orquestrador cuida).

## Iteration anterior — FEEDBACK fb1 iter 2 anima-deck (2026-07-12 · GLM ITERATE, skill /fable-frontend)
Gate rejeitou iter 1: fonte ainda "fina/pouco profissional" (Saira Condensed = condensed, optical estreita em mobile).
- **Fonte (núcleo do feedback)**: Saira Condensed → **Unbounded** (wght 500-900, NÃO-condensed, acentos PT-BR, presença premium/TCG) em `--af-display`. Override **local** em `apps/anima-deck/src/app/globals.css`; `<link>` 500-900 em `layout.tsx`. packages/ui intocado → waifu-chat/anime-quiz não mudam de pele.
- **Peso/contraste premium**: peças-estrela 700→**800** (hero h1, nome do card, reveal-rarity, scene-num, quiz h2) + tracking ~0.01em (Unbounded larga dispensa o tracking largo que condensed pedia). Nome do card: clamp max 2.3→2.1 + `text-wrap: balance` p/ não estourar em mobile.
- **Fidelidade preview↔export (guardrail)**: `renderNodeToBlob` agora embute **Unbounded 800** no `@font-face` base64 do SVG→PNG (era Saira 700) — card na tela e PNG baixado/share na mesma fonte.
- **YAGNI (intocado)**: personagem/lineart (iter 1), wizard, botão Aleatório, i18n PT/EN, share/download — feedback desta rodada era só fonte+premium.
- **VERIFY**: `npm run build -w @forge/anima-deck` **EXIT 0** (lint+types OK). ⚠ verify visual (browser real) pendente no gate humano — confirmar leitura "premium" no preview `iterate-visual`.
Próximo: humano valida no preview (forge decide iterate-visual go|kill). Não rodei git (orquestrador cuida).

## Iteration anterior — FEEDBACK fb1 iter 1 anima-deck (2026-07-12 · GLM ITERATE)
1 iteração aplicando o feedback do dono. Build `@forge/anima-deck` exit 0.
- **Fonte (explícito)**: Bebas Neue (peso único, SEM acentos → nomes acentuados quebravam) → **Saira Condensed** (wght 600-800, acentos PT-BR) no `--af-display`. Override **local** em `apps/anima-deck/src/app/globals.css` (packages/ui intocado → waifu-chat/anime-quiz não mudam de pele). Pesos 700 em h1/h2/nome/scene-num/reveal.
- **Estética do personagem**: lineart (stroke `#1a0f24`, ~1.4-1.6px) em cabelo/rosto/ombros do `AvatarSvg` — acabamento cel-shaded que faltava (antes só fills).
- **Criação fácil**: botão **Aleatório** (shuffle) no topbar do wizard → `randomDraft()` preenche todos os campos + pula pro último step (1 toque → só forjar).
- **Compartilhar/Baixar**: `shareCard` agora manda a **imagem** do card via `navigator.share({files})` (Stories/WhatsApp direto, AbortError respeitado); download e share usam `renderNodeToBlob`, que **embeda `@font-face` Saira Condensed em base64** no SVG → PNG com a fonte certa (antes caía p/ fonte do sistema por CORS no contexto `<img>`).
Próximo: humano valida no ar (deck.gbbragadev.com). Não rodei git (orquestrador cuida).

<!-- forge:begin:doki-call -->
## Forge autopilot — doki-call
- **Ideia:** O ANIMA//DECK ficou dividido corretamente em duas camadas:

Visão completa: criação por IA/selfie, packs, inventário, raridades,
evolução, temporadas e Álbum Vivo. Wedge v0: criador estático de
personagem e photocard, sem backend, conta, pagamento ou geração por IA,
feito especificamente para medir criação e compartilhamento.

O próximo produto pode repetir essa lógica:

uma visão completa de companion altamente personalizável; um v0
extremamente focado em provar que alguém paga para receber uma ligação.
Próxima aposta: DOKI//CALL

Crie sua waifu original, defina a personalidade dela e receba uma
ligação em tempo real.

Classificação Aspecto Definição Tipo Híbrido, mas monetização-first
Aquisição Reel, Story e demonstração da voz Emoção Curiosidade, romance,
exclusividade e personalização Produto pago Ligação ao vivo com a
personagem criada Diferencial Não é só chat de texto: é uma personagem
que fala, reage e lembra IP Personagens e vozes originais Veredito
inicial GO condicionado --- content-first

O ponto mais importante é este:

O usuário não deve pagar apenas pelo "+18". Ele deve pagar pela ligação,
memória e personalização.

O modo adulto deve ser uma camada opcional. Assim, o produto continua
monetizável mesmo se um provedor restringir conteúdo explícito ou mudar
sua política.

A estratégia de compra por impulso

A melhor oferta não é "assine um chatbot". Isso exige confiança demais.

A oferta deve ser:

"Atender uma ligação de cinco minutos da personagem que você acabou de
criar."

Funil recomendado Etapa Experiência Objetivo psicológico 1. Hook Reel
mostrando uma chamada chegando Curiosidade 2. Criação Nome,
personalidade, relação, voz e intensidade Sensação de propriedade 3.
Prova gratuita Três mensagens de texto Demonstrar personalidade 4.
Momento de presença Um áudio curto usando o nome do usuário Demonstrar
que ela "existe" 5. Paywall "Atender ligação ao vivo --- 5 minutos por
R\$ 4,90" Compra pequena e concreta 6. Entrega Chamada começa
imediatamente após o pagamento Recompensa instantânea 7. Upsell Mais
minutos, memória persistente ou áudio exclusivo Aumentar ticket

A etapa gratuita pode usar texto + uma mensagem curta por TTS, deixando
o Realtime reservado para clientes pagantes. Isso reduz drasticamente o
custo de usuários que entram apenas por curiosidade.

Copy principal do paywall SUA PERSONAGEM ESTÁ PRONTA

Ela já sabe seu nome, sua personalidade e o que você acabou de contar.

Atender ligação ao vivo 5 minutos · R\$ 4,90

\[ ATENDER AGORA \]

Abaixo do botão:

Pagamento único. Sem assinatura. A conversa continua do ponto em que
parou.

Isso é mais forte que vender "créditos" logo no primeiro contato. O
usuário entende exatamente o que está comprando.

Estrutura de ofertas

A primeira tela deve mostrar somente a oferta de R\$ 4,90. Mais opções
aparecem depois do clique ou após a primeira chamada.

Oferta Entrega Preço proposto Custo bruto de voz na xAI Degustação
Texto + áudio curto Grátis TTS, sem Realtime Primeira Ligação 5 minutos
ao vivo R\$ 4,90 US\$ 0,25 Encontro Privado 12 minutos + memória R\$
9,90 US\$ 0,60 Passe da Noite 30 minutos + memória por 7 dias R\$ 19,90
US\$ 1,50

Esses custos de voz são calculados pela tarifa atual publicada de US\$ 3
por hora para o agente de voz da xAI, antes de câmbio, impostos,
infraestrutura e taxa do meio de pagamento. A xAI também publica TTS por
caractere, o que torna uma mensagem de voz curta mais apropriada para a
degustação gratuita.

Melhor order bump

Depois que o usuário escolher a primeira ligação:

Adicionar áudio personalizado para guardar "Boa noite, \[nome\]"

-   R\$ 2,90

É um produto digital instantâneo, pessoal e emocional. Também pode ser
baixado e enviado em grupos, gerando tráfego orgânico.

A experiência de personalização

O usuário não precisa construir uma personagem visual inteira no v0.
Isso aumentaria demais o escopo.

Personalização mínima 1. Identidade Nome da personagem; nome pelo qual
ela chama o usuário; idade da personagem, sempre explicitamente 21+;
pronome; relação inicial. 2. Personalidade

Escolha uma personalidade principal:

provocadora; carinhosa; sarcástica; dominante; misteriosa; caótica.

E um traço secundário:

ciumenta; protetora; competitiva; tímida; confiante; dramática. 3.
Cenário primeira ligação; encontro virtual; rivalidade; missão secreta;
reencontro; conversa de madrugada. 4. Voz

No v0, usar entre três e cinco vozes prontas:

suave; energética; elegante; misteriosa; confiante.

A xAI documenta vozes prontas com diferentes tons, suporte a conversa
speech-to-speech de baixa latência e também vozes customizadas. Para o
MVP, as vozes prontas são preferíveis; clonagem de voz só deveria entrar
com contrato e consentimento explícito de uma atriz de voz.

5.  Intensidade ○ Amigável ○ Romântica ○ Provocadora ○ After Dark 18+

O modo adulto não deve aparecer antes da confirmação de idade.

Como o "+18" deve funcionar

Há uma diferença importante entre:

romance; flerte; linguagem sugestiva; roleplay adulto; conteúdo sexual
gráfico.

Nenhuma das páginas oficiais consultadas concede uma autorização
irrestrita para erotismo explícito em aplicações comerciais. Portanto, o
app precisa tratar essa capacidade como configurável por provedor, não
como promessa fixa do produto.

As políticas atuais da OpenAI proíbem conteúdo íntimo não consensual,
violência sexual, sexualização de menores, roleplay sexual com menores e
uso indevido da voz ou imagem de terceiros. A política atual da xAI
também proíbe sexualização de crianças, nudificação ou representação
pornográfica de pessoas reais, personificação enganosa e serviços pagos
que ofereçam outputs violadores.

Regras obrigatórias Todas as personagens têm 21 anos ou mais. Nenhum
arquétipo pode parecer escolar ou menor de idade no modo adulto. Nenhum
personagem, nome, roupa, voz ou história de anime existente. Não
permitir clonagem de dubladores, celebridades ou pessoas reais.
Aquisição no Instagram permanece SFW. O modo adulto fica em rota
separada e atrás de age gate. O usuário pode definir limites e tópicos
proibidos. O app precisa ter saída imediata da conversa e exclusão do
histórico. O conteúdo básico continua funcionando sem modo adulto.

Isso é especialmente relevante porque a descrição atual do público do
ANIMA//DECK inclui usuários de 16 a 28 anos. O produto adulto não pode
assumir que toda a audiência proveniente da página é maior de idade.

OpenAI Realtime versus Grok Voice Minha recomendação para o MVP: xAI
como primário, interface abstrata desde o início Critério xAI/Grok Voice
OpenAI Realtime Cobrança US\$ 3 por hora Por tokens de áudio
Previsibilidade de margem Alta Média Conversa speech-to-speech Sim Sim
Cliente seguro Tokens efêmeros Credenciais efêmeras Browser
WebSocket/WebRTC demonstrado WebRTC recomendado Vozes prontas Sim Sim
Voz customizada documentada Sim Não usaria no v0 Certeza sobre erotismo
explícito Não Não Uso recomendado Voz principal do MVP Fallback e modo
SFW

A xAI documenta o grok-voice-latest como speech-to-speech em tempo real,
com latência inferior a um segundo, endpoint Realtime e tokens efêmeros
para clientes.

A OpenAI também possui arquitetura apropriada para browser: sessões
Realtime, comunicação por WebRTC, credenciais efêmeras e modelos
gpt-realtime-2.1 e gpt-realtime-2.1-mini. Atualmente, o modelo mini
publica valores de US\$ 10 por milhão de tokens de áudio de entrada e
US\$ 20 por milhão de saída; a versão completa publica US\$ 32 e US\$
64, respectivamente.

A aplicação deve ter uma interface como:

interface RealtimeVoiceProvider { createSession(input:
VoiceSessionInput): Promise`<VoiceSession>`{=html};
endSession(sessionId: string): Promise`<void>`{=html};
getUsage(sessionId: string): Promise`<VoiceUsage>`{=html};
supportsMode(mode: "safe" \| "romantic" \| "mature"): boolean; }

Isso impede que uma mudança de preço, disponibilidade ou política mate o
produto inteiro.

Escopo fechado do v0 Incluir três personagens originais; seis
combinações de personalidade; três vozes; nome do usuário; texto
gratuito limitado; uma mensagem de voz curta; ligação Realtime paga;
oferta única de R\$ 4,90; pagamento Pix/cartão; sessão convidada, sem
cadastro obrigatório antes da compra; contexto preservado após
pagamento; limite de minutos controlado no servidor; telemetria do
funil; age gate; moderação básica; histórico temporário; botão
compartilhar resultado SFW. Não incluir geração de avatar por IA; upload
de selfie; clonagem de voz pelo usuário; dezenas de personagens;
inventário; gamificação complexa; feed social; assinatura recorrente na
primeira versão; relacionamento com níveis; conteúdo adulto gráfico como
requisito do lançamento. Hooks para Instagram

Todos funcionam sem anunciar conteúdo explícito:

Hook 1

"Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Hook 2

"Escolhi 'sarcástica + ciumenta' e ela falou meu nome..."

Hook 3

"Esse site cria uma personagem e faz ela te ligar de verdade."

Hook 4

"Não coloque 'dominante' e 'caótica' ao mesmo tempo."

Hook 5

"A conversa era normal até ela mandar esse áudio."

O Reel termina com a tela:

CRIE A SUA link na bio Teste antes do desenvolvimento

Antes do Realtime completo, o P1 pode testar intenção de compra com:

mockup funcional da criação; áudio pré-gerado usando uma personagem
original; botão Atender ligação --- R\$ 4,90; após o clique, tela
transparente de "lançamento em breve" e captura de interesse.

Métricas principais:

visita → início da criação início → personagem concluída personagem →
reprodução do áudio áudio → clique em comprar clique → pagamento
pagamento → segunda compra

A métrica mais importante não é tempo de chat. É:

Quantas pessoas que ouviram a mensagem personalizada clicaram para
atender a ligação?

Scorecard inicial Critério Nota Hook demonstrável em um Reel 5/5 Fit com
audiência otaku 5/5 Potencial de compra por impulso 5/5 Capability já
existente no Anime Forge 3/5 Economia de API 4/5 Velocidade do MVP 3/5
Risco de política, idade e distribuição 2/5 Total 27/35 Decisão

GO condicionado.

Condições:

aquisição SFW; personagens sempre adultas e originais; chamada como
objeto principal da compra; modo adulto desacoplado do produto; xAI como
primeiro teste econômico; provider abstraction desde o início; P1 de
conteúdo e fake-door antes do build completo. Bloco pronto para o Anime
Forge --- L0/P0 IDEIA:

Nome provisório: DOKI//CALL

Webapp mobile-first no qual o usuário cria uma waifu original e adulta,
escolhendo nome, personalidade, relação, cenário e voz.

Depois da personalização, recebe: - 3 mensagens de texto gratuitas; - 1
mensagem de voz curta usando seu nome; - oferta para atender uma ligação
speech-to-speech em tempo real.

Oferta principal: "Ligação ao vivo de 5 minutos --- R\$ 4,90" Pagamento
único, preferencialmente Pix/cartão, entrega imediata e sem cadastro
obrigatório antes da compra.

Categoria: Híbrido, monetização-first.

Hook: "Você teria coragem de atender uma ligação da waifu que acabou de
criar?"

Capability: - chat existente; - adicionar capability realtime-voice; -
provider abstraction; - xAI/Grok Voice como candidato primário; - OpenAI
Realtime como fallback.

Escopo do v0: - 3 personagens originais; - 6 personalidades; - 3
vozes; - texto gratuito limitado; - voice note TTS; - ligação Realtime
paga; - memória somente durante a sessão; - telemetria; - checkout; -
age gate; - moderação.

Modo +18: - não é requisito para monetização; - somente para usuários
verificados como adultos; - personagens explicitamente 21+; - sem
personagens escolares ou minor-coded; - sem pessoas reais, celebridades,
dubladores ou franquias; - implementar apenas se o provedor e o
processador de pagamento permitirem; - aquisição e conteúdo
compartilhável permanecem SFW.

Fora do v0: - avatar por IA; - selfie; - clonagem de voz pelo usuário; -
assinatura; - inventário; - níveis de relacionamento; - comunidade; -
dezenas de personagens.

Objetivo do P0: Avaliar hook, intenção de compra, custo por chamada,
risco de política, risco de idade, fit com Instagram e tempo de
implementação.

Resultado esperado: GO condicionado a P1 content-first e teste de clique
no CTA de R\$ 4,90.

Este conceito deve ser registrado como a primeira aposta
monetização-first do portfólio, enquanto o ANIMA//DECK permanece como
aposta engagement/share-first.
- **Team:** ggg · **Status:** blocked
- **Job atual:** P3 (10/10)
- **Branch:** pipeline/doki-call · checkpoints: 10
- **⏸ GATE pendente:** `blocked-P3` — P3 bloqueado: VERCEL_TOKEN não está no ambiente. retry (zera tentativas) ou kill? → `forge decide blocked-P3 go|kill`
- BLOCKED: VERCEL_TOKEN não está no ambiente
_Atualizado 2026-07-13T03:07:55.443Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/doki-call.json_
<!-- forge:end:doki-call -->
