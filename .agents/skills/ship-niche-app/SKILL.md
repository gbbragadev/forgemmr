---
name: ship-niche-app
description: >
  Roda UMA iteração dos loops da Anime Forge (L0 product / L1 build / L2 handoff).
  Detecta estado via workbench, claima job, implementa o mínimo OU gera prompt GLM denso,
  verifica build, atualiza HANDOFF/QUEUE/CLAIMS. Use com Codex ($ship-niche-app), Claude
  (/ship-niche-app), Grok, Gemini, ou "próximo loop forge", "segue", "ship niche app".
---

# ship-niche-app

## Quando usar

- Continuar a factory multi-agente sem reexplicar o repo
- Rate limit: retomar via L2
- “segue”, “próximo job”, “fecha o loop”, “ship waifu-chat / anime-quiz”
- “pode decidir e seguir” / “siga até decisão minha” (ver gates)
- “outra ideia” / “próximo app” / “setar ideia nova” → `docs/prompts/L0-NOVA-IDEIA.md`

## Não usar

- Ideias fora do monorepo anime-forge
- Refactor gigante multi-app sem job na QUEUE
- Billing/image sem item explícito na QUEUE
- Implementar B3 visual pesado no lugar do GLM (gerar prompt em vez disso)

## Protocolo (obrigatório)

### 1. Orientar

1. `AGENTS.md`
2. `workbench/HANDOFF.md`
3. `workbench/QUEUE.md`
4. `workbench/CLAIMS.md`
5. Se precisar: `docs/AGENT-PIPELINE.md` (lições + ship matrix)

### 2. Detectar loop / job

| Sinal | Loop / job |
|-------|------------|
| User: outra ideia / próximo app / app anterior Done | L0 swap → `L0-NOVA-IDEIA` / P0 |
| HANDOFF pede scorecard / ideia nova | L0/P0 |
| Falta content hooks | L0/P1 |
| P0 GO + P1 ok + user “pode decidir” | L1/B1 permitido |
| App sem pasta / config | L1/B1 |
| Personas faltando | L1/B2 |
| UI feia / share / apelo anime | L1/B3 → **prompt GLM denso**, não código |
| API/chat/credits / key smoke | L1/B4 ou B5 |
| B5 ok sem URL | P3 deploy (se autorizado) |
| Claim paused / continue HANDOFF | L2 → retoma job |
| QUEUE Doing não vazio | esse job |
| QUEUE só Backlog | primeiro Backlog **ou** perguntar |

**Default:** uma invocação = uma iteração.  
**Exceção:** “siga até decisão minha” — encadear jobs **não ambíguos** até gate humano (P4 measure, key, billing, domínio, escolha de produto).

### 3. Claim

`slot | <agent> | L0|L1|L2 | <job> | <app> | <time>`  
QUEUE: Backlog → Doing.

### 4. Executar

| Job type | Ação |
|----------|------|
| L0 P0/P1 | Artefato markdown; **sem** código app |
| L1 B1/B2/B4/B5 | Código mínimo + VERIFY |
| L1 B3 | Preencher `docs/prompts/L1-B3-TEMPLATE.md` → `workbench/prompts-glm/` |
| P3 deploy | Ship matrix: static→GH Pages; server→Vercel se token |

- Personas: originais/arquétipos  
- Keys produto: ler env; **nunca pedir no chat**  
- Portas: se HTTP body = `Running`, não é o Next  
- VERIFY: `npm run build` ou `build:quiz`  
- Fail ≤3 → senão BLOCK HANDOFF  

### 5. Fechar

1. Doing → Done **ou** blocker + Next  
2. HANDOFF (loop, last agent, next, blockers, **URL** se ship)  
3. Claim limpo  
4. Responder: loop, job, PASS/FAIL, próximo óbvio  

## Preferência de agente

| Job | Preferir |
|-----|----------|
| P0 P1 P4 | Grok / Gemini |
| B1 B4 | Codex |
| B2 | Grok / Gemini |
| B3 | **GLM 5.2 MAX** (prompt gerado por Grok/Codex) |
| B5 P3 | qualquer sub + CI |
| L2 | provedor com cota |

## Definition of Done

- [ ] Escopo da invocação respeitado (1 job ou chain autorizada)
- [ ] VERIFY se houve código
- [ ] B3: prompt denso versionado (não one-liner)
- [ ] workbench coerente + claim limpo
