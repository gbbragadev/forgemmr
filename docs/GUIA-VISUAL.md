# Guia visual — Como usar a Anime Forge corretamente

> **Abra no browser:** [`GUIA-VISUAL.html`](./GUIA-VISUAL.html) (recomendado)

## Como setar outra ideia (app anterior terminou)

Passo a passo canônico: **[`PLAYBOOK.md` § Como setar outra ideia](./PLAYBOOK.md)**  
Prompt pronto: **[`prompts/L0-NOVA-IDEIA.md`](./prompts/L0-NOVA-IDEIA.md)**

1. App anterior em **Done** na QUEUE (measure humano pode ficar à parte)
2. Claim limpo
3. Backlog: `L0/P0 Scorecard: <id> — <frase>`
4. HANDOFF: loop ativo = ideia nova
5. Colar `L0-NOVA-IDEIA.md` + a ideia (ou só P0 scorecard)
6. GO → P1 hooks → só então B1 / `NOVO-APP.md`

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + HANDOFF + QUEUE + docs/PLAYBOOK.md (setar outra ideia).
App anterior FECHADO em build. Rode L0/P0 da ideia nova.
Atualize HANDOFF/QUEUE. Não scaffold nesta rodada se só for scorecard.
IDEIA NOVA: <<< >>>
```

---

## Novo app com 1 prompt (já com GO / “pode decidir”)

1. Escolha `id`, `name`, one-liner PT-BR, capability=`chat`
2. Abra `C:\Dev\anime-forge` no agent da **subscription** (Codex recomendado)
3. Cole o prompt de **[`docs/prompts/NOVO-APP.md`](./prompts/NOVO-APP.md)** e preencha os `<<< >>>`
4. Confira: `apps/<id>` · `npm run build` · personas ≥ 4 · HANDOFF atualizado
5. Rode: `npm run dev -w @anime-forge/<id>`

Opcional antes: scorecard `docs/prompts/L0-P0-scorecard.md` (se NO-GO, não scaffolda).

### Prompt curto (mesmo conteúdo do HTML)

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md + docs/prompts/NOVO-APP.md.

Criar NOVO app: copiar apps/waifu-chat → apps/<id>
Spec: id=<<<>>> name=<<<>>> one-liner=<<<>>> capability=chat
4–6 personas OCs PT-BR · freePerDay=2 · 5 hooks share
Subscription only · OPEN_ROUTER_API_KEY = env Windows (não pedir)
NÃO billing · NÃO image · NÃO alterar waifu-chat além de copiar
Claim L1/B1 · npm run build · HANDOFF/QUEUE · me diga o dev command
Comece agora.
```

Depois: content hooks (`L0-P1`) → ship check (`L1-B5`).

---

## Em 30 segundos

```
Você + SUBS (Claude/Codex/Grok/Gemini)
  → L0 ideia/content  (workbench + prompts)
  → L1 código         (Codex/Claude · Bernstein opcional)
  → L2 rate-limit     (HANDOFF → outra sub → mesmo job)

App WaifuChat
  → OPEN_ROUTER_API_KEY do Windows (não pedir no chat)
```

## Protocolo de sessão

1. Abrir pasta `C:\Dev\anime-forge` no agent da **subscription**
2. Ler `AGENTS.md` + `workbench/HANDOFF.md` + `QUEUE.md`
3. Claim em `CLAIMS.md` · **1 job**
4. Fazer o job · se código: `npm run build`
5. Atualizar HANDOFF + QUEUE · liberar claim

### Frase mágica

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + workbench/HANDOFF.md + QUEUE.md.
UMA iteração. Claim. HANDOFF no fim.
OPEN_ROUTER_API_KEY = env sistema (não pedir). Coding = só subscription.
```

## Loops

| Loop | O quê |
|------|--------|
| **L0** | score → content → build → ship → measure → kill\|scale |
| **L1** | claim → implement → verify → fix |
| **L2** | limite → HANDOFF → outra sub |

Prompts: `docs/prompts/`

## Subs → jobs

| Preferir | Jobs |
|----------|------|
| Grok / Gemini | P0, P1, B2 |
| Codex | B1, B4 |
| Claude | B3 UI |
| Bernstein | L1 paralelo + `bernstein live` (opcional) |

## Keys

| Key | Ação |
|-----|------|
| `OPEN_ROUTER_API_KEY` | Ler env Windows — **não pedir** |
| API coding pay-as-you-go | **Não** |

## App

```powershell
cd C:\Dev\anime-forge
npm run dev      # :3000
# /api/health
npm run build
```

## Bernstein (opcional)

```powershell
bernstein doctor
bernstein live
bernstein
```

Detalhe: `docs/BERNSTEIN-PILOT.md`

## Não faça

- Sessão com 5 features  
- Recomeçar do zero no rate limit  
- Pedir key OpenRouter no chat  
- Langflow/CLI-Anything/MALLM “pra ver progresso”  
- Declarar pronto sem build  
