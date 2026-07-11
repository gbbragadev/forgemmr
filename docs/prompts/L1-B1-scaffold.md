# L1 / B1 — Scaffold app (1 iteração)

```
Repo: C:\Dev\anime-forge
Leia AGENTS.md + HANDOFF + QUEUE + scorecard do app se existir.
Loop: L1 Build · Job: B1 Scaffold
Claim exclusivo no app novo.

Pré-condição:
- P0 GO documentado (docs/scorecard-<id>.md)
- Preferir P1 hooks já feitos; se só P0: user deve ter dito “pode decidir e seguir”

Tarefa:
1. apps/<id>/ (clone padrão mais próximo: waifu-chat chat | anime-quiz se static)
2. package.json name @anime-forge/<id>
3. app.config.ts: id, seo, capabilities, personas/arquétipos, disclaimer
4. Fluxo core mínimo (chat OU quiz OU outra capability claimada)
5. Scripts root se precisar (dev:<id>, build:<id>)
6. VERIFY: npm run build -w @anime-forge/<id> (ou build:quiz)

Constraints:
- YAGNI visual: texto seco / UI mínima é ACEITO no B1
- NÃO fazer B3 (polish anime) nesta iteração — enfileirar B3 na QUEUE
- Não billing/image sem job
- Personas: originais/arquétipos; sem IP
- Static free path → considerar output: "export" se sem API
- Escolher porta livre (evitar :3001 se Docker “Running”)

App id: <<< >>>
Capability: <<< chat | quiz | … >>>
Ao falhar build: fix máx 3 ou BLOCK HANDOFF.
Fim: HANDOFF Next = B3 prompt GLM e/ou B4/B5 · QUEUE · claim.
```
