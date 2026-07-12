# HANDOFF

## Loop ativo
**L0** — DOKI//CALL (slug `o-anima-deck`) — P0 **GO condicionado**; próximo = **L0/P1**

## Last agent
grok-solo | 2026-07-12 · L0/P0 scorecard

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

## Done (harness)
- Loops L0/L1/L2 multi-sub (Claude/Codex/Grok/Gemini + GLM B3)
- workbench QUEUE/HANDOFF/CLAIMS
- Guia visual, PLAYBOOK, ship matrix, content-first gates
- OpenRouter: `OPEN_ROUTER_API_KEY` env sistema (não pedir no chat)

## Next
1. **L0/P1** DOKI//CALL: 15 hooks + brief fake-door (CTA R$ 4,90, áudio demo, captura interesse) — **sem** Realtime ainda
2. **Humano P4** anime-quiz: hooks + bio → URL Pages (5–7d) — `docs/content-hooks-anime-quiz.md`
3. **Token Cloudflare**: Pages:Edit + DNS:Edit → deploy automático `<app>.gbbragadev.com`

## Blockers
- P4 measure = humano
- Deploy automático cf-pages = token CF read-only (3 passos no gate)
- Vercel server deploy = token

## Links
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
- **Team:** grok-solo · **Status:** paused_gate
- **Job atual:** FOUNDATION (2/9)
- **Branch:** pipeline/o-anima-deck · checkpoints: 1
- **⏸ GATE pendente:** `p0-go` — Scorecard pronto (apps/o-anima-deck/docs/scorecard.md). GO ou KILL? → `forge decide p0-go go|kill`
_Atualizado 2026-07-12T22:38:47.962Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/o-anima-deck.json_
<!-- forge:end:o-anima-deck -->

<!-- forge:begin:doki-call -->
## Forge autopilot — doki-call
- **Ideia:** "C:\Dev\anime-forge\ideas\DOKI_CALL_Produto_e_Estrategia.md"
- **Team:** frontier-cxb · **Status:** running
- **Job atual:** — (1/10)
- **Branch:** pipeline/doki-call · checkpoints: 0
_Atualizado 2026-07-12T23:20:32.470Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/doki-call.json_
<!-- forge:end:doki-call -->

<!-- forge:begin:prova-3x -->
## Forge autopilot — prova-3x
- **Ideia:** prova de tres pipelines ativas ao mesmo tempo
- **Team:** dry-run · **Status:** killed
- **Job atual:** — (2/9)
- **Branch:** pipeline/prova-3x · checkpoints: 1
- pipeline encerrada: killed
_Atualizado 2026-07-12T23:51:09.708Z pelo forge (maestro/engine.mjs). Estado completo: maestro/pipelines/prova-3x.json_
<!-- forge:end:prova-3x -->
