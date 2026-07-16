# Contratos do Forge Operator

## Comandos canônicos

```powershell
node maestro/forge.mjs status
node maestro/forge.mjs roster
node maestro/forge.mjs ingest "<texto|arquivo|pasta|URL>" --team <id> --review-only
node maestro/forge.mjs ingest "<texto|arquivo|pasta|URL>" --team <id> --apply
node maestro/forge.mjs decide <gate> <choice> "<feedback>" --app <appId>
node maestro/forge.mjs stop <appId>
node maestro/forge.mjs resume <appId>
node maestro/forge.mjs simulate <appId> --team <id>
node maestro/forge.mjs feedback <appId> "<feedback>" --team <id>
node maestro/forge.mjs evolve "<requisito>" --executor <codex|grok|claude|gemini>
```

Preferir `ingest` a `new` para ideias naturais, pois ele decide e registra profile e blueprint antes de iniciar.

## Especificacao de time

Consultar `snapshot` imediatamente antes de criar. Usar somente `provider`, `model` e `effort` expostos como instalados.
O arquivo `team-grok-example.json` e um molde; preferir reutilizar `grok-solo` se ele ja existir.

```json
{
  "name": "Nome legivel",
  "emoji": "🎼",
  "fallbackPolicy": "strict",
  "members": [
    {
      "provider": "grok",
      "model": "default",
      "effort": "high",
      "roles": ["Estrategista", "Engenheiro", "Designer", "QA", "Revisor"]
    }
  ]
}
```

Papeis validos:

| Papel | Jobs principais |
|---|---|
| `Estrategista` | L0/P0, FOUNDATION, L0/P1, L1/B2 |
| `Engenheiro` | L1/B1, L1/B4 |
| `Designer` | L1/B3, ITERATE, DS-GEN |
| `QA` | L1/B5, SIMULATE |
| `Revisor` | revisao adversarial pos-B1/B4 |

Usar de 1 a 8 membros. `strict` remove fallbacks; `fallback` permite somente os fallbacks gerados e visiveis no roster.
Validar uma especificacao sem salvar com `forge-control.mjs save-team --spec <arquivo.json> --dry-run`.

## Estados e gates

| Estado | Conduta do orquestrador |
|---|---|
| `running` | observar eventos e continuar |
| `paused_gate` | apresentar ou decidir conforme autorizacao |
| `blocked` | diagnosticar causa e retry limitado ou handoff |
| `error` | confirmar erro real, preservar logs e recuperar |
| `done` | verificar resultado e fechar |
| `killed` | nao reiniciar sem pedido explicito |

`full_auto` resolve somente gates locais cobertos pelo proprio verify: `p0-go` com verdict GO/GO condicionado, `foundation-review`, `ds-pick` pela recomendacao explicita do design-system e gates visuais com diff real de UI mais build verde. Cada escolha fica auditavel com ator automatico e motivo.

Gates externos ou sem evidencia permanecem humanos: `p1-signal`, deploy, billing, dominio, medicao P4, decisao P5, provider login, segredo e alegacao legal. `autopilot_to_gate` preserva o comportamento legado e para em todos os gates contratuais.

## Acompanhamento

`forge-control.mjs observe` retorna um resumo pequeno:

- `pipeline`: fase, player, jobs, gate pendente e ultimos histories;
- `events`: apenas eventos do app depois do cursor;
- `nextCursor`: usar como `--after` na proxima chamada.

Nao ler o JSON completo da pipeline a cada ciclo; ele pode conter ideias longas e historico volumoso.
