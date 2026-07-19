# Playbook — Forge Discovery-First

Pipeline de **negócio profile-driven**. Código e handoff: `docs/AGENT-PIPELINE.md`.

## Uma volta do loop padrão

```
room/chat → tese confirmada → playbooks → evidência verificada
          → E1 dor+alcance → E2 ação real → build mínimo
          → conclusão instrumentada → aquisição/Braga
          → E3 econômico/repetível → P5 kill|iterate|scale
```

### Regras de passagem

1. Chat é livre e multi-host; somente confirmação humana promove uma tese.
2. `pain-signal-miner` e `first-customer-finder` importam candidatos externos como `unverified`.
3. E1 exige dor e segmento/canal alcançável; E2 exige ação externa real verificada.
4. `startup-user-simulator`, `design-audit`, score e consenso são sempre `synthetic` e nunca provam demanda.
5. E1+E2 permitem **propor** build; aprovação explícita abre um único build mínimo.
6. Aquisição exige build testável, instrumentação observada e slot livre.
7. BragaMarketing recebe handoff versionado; o Forge não escreve no repo externo e importa métricas como `channel_metric`.
8. E3 exige comportamento econômico/repetível e experimento concluído; `scale` cria teto e próxima data de medição.

WIP: **3 teses em validação / 1 build / 1 aquisição**. Não há outreach, publicação, deploy ou gasto automático. Gasto exige `why`, confirmação e teto separado. Agentes usam somente CLIs de subscription, nunca paygo.

## Playbooks provider-neutral

| Playbook | Uso | Limite |
|---|---|---|
| `pressure-test` | explicitar hipótese fatal e risco | não produz evidência de demanda |
| `pain-signal-miner` | encontrar sinais públicos de dor | URL candidata fica `unverified` |
| `first-customer-finder` | mapear segmento e abertura sugerida | não contata ninguém |
| `startup-user-simulator` | crítica sintética pós-build | nunca satisfaz E1/E2/E3 |
| `design-audit` | crítica interna de interface | nunca satisfaz E1/E2/E3 |

## Compatibilidade L0/P0–P5

Pipelines legadas continuam retomáveis e os materiais abaixo seguem úteis para apps existentes. Para produto novo, P0/P1 podem informar a tese, mas não substituem evidência externa nem autorizam `pipeline.start`; a entrada pública é discovery-first.

## Scorecard P0 (legado compatível)

| Critério | Peso |
|----------|------|
| Hook em 1 frase + visual shareable | alto |
| Capability já existe? (`chat` / `quiz` / `image`) | alto |
| Custo API &lt; preço coin (static free path = 5/5) | alto |
| Fit audiência anime | alto |
| Risco legal OK (arquétipos &gt; IP) | alto |

Capability **não** existe e score baixo → só conteúdo, **sem** L1.  

### Gate de mercado obrigatório

Todo scorecard P0 declara **Comprador**, **Canal**, **Preço-alvo** e **Recorrência** com respostas concretas. Sem os quatro campos preenchidos, o job reprova antes do gate. Isso valida estrutura, não mérito: um NO-GO completo continua até o gate humano, que decide GO, retry ou kill.

Sempre salvar: `docs/scorecard-<app-id>.md`.

## P1 Content

15 hooks PT-BR (`docs/content-hooks-<id>.md`).  
CTA: **URL ship** na bio quando existir (ex. Pages).  
**Não** pivotar a conta anime para outro nicho.

## P2 Build (L1)

Ordem típica:

1. **B1** scaffold — funcional (visual seco OK)  
2. **B2** personas/arquétipos se precisar  
3. **B3** apelo visual — **GLM + prompt denso** (não pular se o produto é share)  
4. **B4** API se chat  
5. **B5** ship-check  

B1 sem P1 só com user “pode decidir e seguir”.

## P3 Ship

| Tipo app | Path |
|----------|------|
| Static (`output: "export"`) | GitHub Pages workflow |
| Server (API) | Vercel + env keys |

Exemplo: AnimeQuiz → https://gbbragadev.github.io/anime-forge/

## P4–P5 Measure → Kill|Scale

Prompt: `docs/prompts/L0-P4-measure-kill.md`.  
Kill se bio não converter em ~5–7 dias.  
Scale = novos jobs L1 (polish, personas, image) na QUEUE.

## Monetização padrão

- Free: 2/dia + watermark (chat) · quiz pode ser free unlimited no free path  
- Coins: R$4,99 / 9,99 / 19,99  
- Weekly: R$9,90–14,90  

## Apps

| App | Capability | Status (2026-07) |
|-----|------------|------------------|
| WaifuChat | chat | MVP + smoke |
| AnimeQuiz | quiz | **shipped** Pages |
| Anime Me / haifu | image | ideia — P0 antes de L1 |
| Polaroid/photocard | image | ideia |
| Fanfic instantânea | chat | ideia |

Cada um = **novo L0**, não feature escondida no app anterior.

## Como setar outra ideia (app anterior terminou)

Use isto quando o app atual saiu do **build** (ex.: anime-quiz shipped) e você quer a próxima aposta.

### Passo a passo

1. **Fecha o app atual no workbench**
   - Jobs de build (P0→B5) → **Done** na `workbench/QUEUE.md`
   - Se ainda for medir: deixe **só** `L0/P4` measure como job **humano** no Backlog (não mistura com o app novo)
   - Libere `workbench/CLAIMS.md` (sem claim órfão)

2. **Não reaproveite o app antigo como “só mudar copy”**
   - Produto novo = **novo L0** (e depois `apps/<novo-id>` se for codar)
   - Measure do anterior pode rodar **em paralelo** (humano + bio), sem bloquear o P0 novo

3. **Enfileira a ideia nova na QUEUE** (`workbench/QUEUE.md` → Backlog):

```markdown
- [ ] **L0/P0** Scorecard: <app-id> — <uma frase da ideia>
```

4. **Atualiza o HANDOFF** (`workbench/HANDOFF.md`):

```markdown
## Loop ativo
**L0** — nova ideia: <app-id> — <uma frase>

## Next
1. L0/P0 scorecard <app-id>
2. Se GO → L0/P1 content hooks
3. B1 scaffold só após P1 (ou user “pode decidir e seguir”)

## Blockers
- (vazio ou measure do app anterior = humano)
```

5. **Roda o scorecard** (qualquer sub: Grok / Gemini / …)
   - Prompt: `docs/prompts/L0-P0-scorecard.md`
   - Cole a ideia em `IDEIA: <<< ... >>>`
   - Salva `docs/scorecard-<app-id>.md`
   - Agent atualiza QUEUE + HANDOFF

6. **Segue o gate L0**
   | Resultado P0 | Próximo |
   |--------------|---------|
   | **NO-GO** | Para. Só conteúdo/teste sem código (ou outra ideia) |
   | **GO** | Enfileira **L0/P1** hooks (`docs/prompts/L0-P1-content-hooks.md`) |
   | Depois P1 | **L1/B1** scaffold (ou prompt `docs/prompts/NOVO-APP.md` se chat clone) |

### Frase mágica (trocar de ideia)

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md.
O app anterior (<id>) está FECHADO em build (Done). Measure humano se existir, à parte.
Próximo produto: rode L0/P0 da ideia nova no Backlog (ou a que eu colar abaixo).
Atualize HANDOFF + QUEUE. Não mexa no app anterior salvo bug/ship.
IDEIA NOVA: <<< cole aqui >>>
```

### Checklist rápido

- [ ] Build do app anterior em **Done** (não em Doing)
- [ ] Claim limpo
- [ ] Backlog tem **L0/P0** da ideia nova (não B1 direto)
- [ ] HANDOFF “Loop ativo” = ideia nova
- [ ] Agent leu frase mágica / P0 prompt
- [ ] Se GO → P1 antes de scaffold (default)

Prompt dedicado: `docs/prompts/L0-NOVA-IDEIA.md`.

## Anti-padrões

- Super-app com 20 features  
- App Store cedo  
- Pivotar conta anime  
- Modelo caro no free  
- Redesign UI **no B1** (deixar pro B3)  
- Abrir L0 novo com L1 vermelho no app atual  
- Scaffold sem P0 GO  
- Prompt B3 de 3 linhas (“fica bonito”)  
