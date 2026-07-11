# Playbook — Anime Forge (L0 Product Loop)

Pipeline de **negócio**. Código e handoff: `docs/AGENT-PIPELINE.md`.

## L0 em uma volta

```
P0 score ──go──► P1 content test ──sinal|decisão──► P2 L1 build ──► P3 ship
                                                                      │
P5 kill|scale ◄── P4 measure (5–7 dias) ◄─────────────────────────────┘
```

## Scorecard P0 (5 min)

| Critério | Peso |
|----------|------|
| Hook em 1 frase + visual shareable | alto |
| Capability já existe? (`chat` / `quiz` / `image`) | alto |
| Custo API &lt; preço coin (static free path = 5/5) | alto |
| Fit audiência anime | alto |
| Risco legal OK (arquétipos &gt; IP) | alto |

Capability **não** existe e score baixo → só conteúdo, **sem** L1.  
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
