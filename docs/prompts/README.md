# Prompts por loop

Cole o bloco do arquivo no Codex / Claude / Grok / Gemini / GLM.

| Arquivo | Loop | Job |
|---------|------|-----|
| **`L0-NOVA-IDEIA.md`** | L0 | Trocar de produto (app anterior Done) |
| **`NOVO-APP.md`** | L1 | B1 scaffold (ainda exige P0 na prática) |
| `L0-P0-scorecard.md` | L0 | P0 → `docs/scorecard-*.md` |
| `L0-P1-content-hooks.md` | L0 | P1 hooks |
| `L0-P4-measure-kill.md` | L0 | P4–P5 |
| `L1-B1-scaffold.md` | L1 | B1 funcional (visual seco OK) |
| `L1-B2-personas.md` | L1 | B2 |
| `L1-B3-ui-polish.md` | L1 | B3 — **gera** prompt GLM, não codifica UI |
| **`L1-B3-TEMPLATE.md`** | L1 | template denso p/ `workbench/prompts-glm/` |
| `L1-B4-wire-api.md` | L1 | B4 |
| `L1-B5-ship-check.md` | L1 | B5 PASS/FAIL/N-A |
| `L2-handoff.md` | L2 | troca de agente |

## B3 / GLM

1. Agente preenche `L1-B3-TEMPLATE.md`  
2. Salva em `workbench/prompts-glm/L1-B3-<app>-<slug>.md`  
3. User cola no **GLM 5.2 MAX**  
4. Checklist de qualidade: `workbench/prompts-glm/README.md`

## Pipeline completo

`docs/AGENT-PIPELINE.md` (lições, gates, ship matrix).

Atalhos legados S0–S6: tabela em `docs/AGENT-PIPELINE.md`.
