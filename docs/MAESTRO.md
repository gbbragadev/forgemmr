# Maestro HQ — cara + controle visual do Bernstein

## ⚡ Forge Autopilot (novo — 2026-07-10)

**Pipeline completa "ideia → app no ar" com decisões pontuais.** A CLI `forge` é a interface
primária; o HQ browser (`:8787`) segue como visor.

```powershell
cd C:\Dev\anime-forge
npm run forge -- new "quiz de openings de anime" --team grok-glm-front
# TUI abre; a pipeline roda P0 → P1 → B1 → B2 → B3(GLM) → B5 → ship sozinha
# e PAUSA só nos 3 gates humanos: p0-go · b3-visual · deploy
```

| Comando | Função |
|---------|--------|
| `forge new "<ideia>" [--team X] [--capability static\|quiz\|chat] [--subdomain X] [--dry-run]` | inicia pipeline + attach |
| `forge attach` | TUI ao vivo (q = detach, pipeline continua) |
| `forge status` | snapshot rápido |
| `forge decide <gate> <go\|kill\|retry> [feedback]` | decide gate sem TUI |
| `forge stop` / `forge resume` | pausa / retoma |
| `forge roster` | teams e players |

**Teams (setup de agente)** — `maestro/roster.json` → `teams`:

| Team | Quem toca |
|------|-----------|
| `grok-solo` (default) | Grok em tudo (SuperGrok, limite folgado) |
| `grok-glm-front` | Grok em tudo + **GLM headless no B3** (sem copiar prompt!) |
| `quality` | Claude Opus executa · Codex revisa · GLM no front |
| `dry-run` | executor fake (testar a pipeline sem gastar limite) |

**Git:** branch `pipeline/<app-id>` · commit checkpoint por job PASS · rollback automático
após 3 falhas · merge+push em master **só** no gate de deploy.

**Rate-limit = L2 automático:** player entra em cooldown 60min e o fallback do team assume.

**Deploy:** `cf-pages` → `<app>.gbbragadev.com` usando o token **`CF_GBBRAGADEV_ADM`**
(admin; verificado real com o quiz → https://quiz.gbbragadev.com) · `vercel` p/ apps
server (`VERCEL_TOKEN`). Sem token válido o gate mostra 3 passos manuais.

**Início rápido:** digite `.\forge` na raiz do repo (ou `npm run forge`) → tela de setup:
ideia → time (↑↓) → tipo → Enter. `forge help` p/ o resto.

**Gotcha Grok (importante):** headless de verdade é `grok -p/--single` — goal posicional abre
a TUI interativa e NUNCA sai (era a causa do hang + ANSI soup). Já corrigido em
`maestro/adapters.mjs`.

Estado durável: `maestro/pipeline.json` · logs por job: `maestro/runs/<runId>/` ·
preview pós-B3: `http://127.0.0.1:8787/preview/<app-id>/`.

---

## O problema

Bernstein por padrão é **CLI-first** (`bernstein live`, `bernstein -g "..."`).  
Você quer:

1. **Visual** na execução (sem ficar digitando comando)
2. **Controle total** dos modelos/CLIs despachados
3. **Pré-mapeados** (sem `cli: auto` cego)
4. Uma **“cara”** — identidade do maestro, não um tool genérico

## A solução: Maestro

| Peça | Função |
|------|--------|
| **Maestro** | Persona/identidade (avatar, voz, tagline) |
| **Orquestra (players)** | Cada “músico” = CLI + model + jobs |
| **Dispatch map** | Job L0/L1 → player fixo |
| **Presets** | Goals de 1 clique |
| **Bernstein GUI** | Tela nativa de execução ao vivo (`:8052/ui`) |
| **start-maestro.ps1** | Sobe GUI + abre HQ (zero typing) |

```
Você clica no Maestro HQ
        │
        ├─► escolhe preset / goal
        ├─► copia goal (1 clique)
        └─► Bernstein GUI mostra agents rodando

Roster (quem toca o quê) = maestro/roster.json
Team Bernstein           = templates/teams/anime-forge.toml
```

## Começar sem digitar

1. No Explorer: duplo clique em  
   `C:\Dev\anime-forge\scripts\start-maestro.ps1`  
   (ou botão direito → Executar com PowerShell)
2. Abre **Maestro HQ** + **Bernstein GUI**
3. No HQ: clique num **preset** → **Copiar goal + abrir GUI**
4. Na GUI do Bernstein: cole/rode o goal (conforme a UI do Bernstein)
5. Acompanhe a execução na GUI (não no terminal)

Atalho: crie um atalho do `.ps1` na área de trabalho e mude o ícone se quiser.

## Controlo de modelos (pré-mapeado)

Edite **`maestro/roster.json`**:

```json
{
  "id": "codex-backend",
  "cli": "codex",
  "model": "default",
  "jobs": ["B1", "B4", "B5"]
}
```

Team espelho em **`templates/teams/anime-forge.toml`**  
e `team: anime-forge` no **`bernstein.yaml`**.

### Mapa default

| Job | Player | CLI |
|-----|--------|-----|
| L1/B1 scaffold | Codex Engine | codex |
| L1/B2 personas | Gemini Spark | gemini (opcional) |
| L1/B3 UI | Claude Front | claude / sonnet |
| L1/B4 API | Codex Engine | codex |
| L1/B5 ship | Claude QA | claude |
| L0 P0/P1 | Gemini Spark | gemini / fallback Claude |

## Cara do Maestro

Definida em `roster.json` → `maestro`:

- `name`, `tagline`, `avatar`, `voice`, `color`
- Troque o emoji/avatar ou copie o estilo pro branding dos apps

Isso é a **skin** da orquestra Anime Forge — não o genérico “Bernstein operator”.

## O que a GUI nativa já dá

```powershell
bernstein gui serve     # http://127.0.0.1:8052/ui/
bernstein live          # TUI 3 colunas (se quiser terminal bonito)
bernstein dashboard     # abre browser na GUI
```

Maestro HQ **não substitui** a GUI de execução; ele é a **recepção + partitura + caras**.  
A GUI Bernstein é o **palco ao vivo**.

## Run real (botão ▶)

```powershell
cd C:\Dev\anime-forge
node maestro/server.mjs
# ou: .\scripts\start-maestro.ps1
# abra http://127.0.0.1:8787
```

| API | Função |
|-----|--------|
| `POST /api/run` | `{ goal, executor: "grok"\|"bernstein"\|"codex"\|"claude", playerId }` |
| `POST /api/stop` | mata a run |
| `GET /api/events` | SSE — log ao vivo |
| `GET /api/status` | estado da run |

### Executor **Grok solo** (E2E)

Preset **E2E teste · só Grok** no HQ:

1. Dispara `grok.exe` headless (`--always-approve`, `--check`)
2. Stream de log no painel
3. Goal cria `maestro/e2e-result.md` + HANDOFF + `npm run build`

Roster: player `grok-solo` · CLI em `%USERPROFILE%\.grok\bin\grok.exe`.

## Arquivos

| Path | Papel |
|------|--------|
| `maestro/index.html` | HQ visual |
| `maestro/roster.json` | Caras + models + presets |
| `templates/teams/anime-forge.toml` | Team Bernstein pinado |
| `bernstein.yaml` | `team: anime-forge` |
| `scripts/start-maestro.ps1` | Launch 1 clique |
| `docs/MAESTRO.md` | este doc |

## Relação com workbench

| Camada | Ferramenta |
|--------|------------|
| Multi-sub / Grok / handoff | workbench |
| Orquestra visual + models fixos | **Maestro + Bernstein** |
| Chat do usuário final | Z.AI (`ZAI_API_KEY`) |
