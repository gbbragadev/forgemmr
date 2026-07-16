---
name: forge-operator
description: Orquestra o Forge por linguagem natural a partir de uma sessao Codex ou Claude Code. Use quando o usuario disser que teve uma ideia, pedir para criar ou escolher profile, blueprint, time ou pipeline, iniciar e acompanhar uma execucao, seguir ou recuperar uma pipeline existente, inspecionar logs reais, ou propor alteracoes no proprio Forge. Aciona pedidos como "tive uma ideia", "cria um time full Grok", "monta a pipeline", "inicia e acompanha", "segue ate o gate" e "melhora o Forge".
---

# Forge Operator

Atuar como o orquestrador conversacional. Usar o Forge como motor de estado, dispatch, verificacao e gates; deixar os players do time executarem os jobs da pipeline.

## Orientar a sessao

1. Confirmar que o cwd pertence ao repo Forge procurando `maestro/forge.mjs`.
2. Ler `AGENTS.md`, `workbench/HANDOFF.md`, `workbench/QUEUE.md`, `workbench/CLAIMS.md` e `docs/FORGE-OPERATOR.md` antes de mutar estado.
3. Consultar o estado vivo, sem confiar apenas no handoff:

```powershell
node .agents/skills/forge-operator/scripts/forge-control.mjs snapshot
```

4. Preservar mudancas locais alheias. Nao reiniciar o Maestro se houver job vivo.

## Interpretar a autorizacao

- Tratar "crie", "monte" e "inicie" como autorizacao para mutacoes locais reversiveis necessarias: reutilizar ou criar profile, blueprint e time, e iniciar a pipeline descrita.
- Tratar "acompanhe" como pedido persistente: continuar observando enquanto estiver `running`; encerrar somente em `done`, gate humano, blocker diagnosticado ou nova instrucao do usuario.
- Tratar "pode decidir e seguir" como autorizacao para decisoes locais reversiveis e retries fundamentados.
- Usar `full_auto` por padrao quando o usuario pedir para iniciar e acompanhar. Nesse modo, o Forge decide apenas gates locais cobertos por evidencias do proprio verify e registra ator, escolha e motivo.
- Nunca inferir autorizacao para push, deploy, dominio, billing, provider login, segredo, exclusao, decisao P4/P5, alegacao legal ou mudanca silenciosa do proprio Forge.
- Manter agentes em assinatura. Nao trocar para API paygo nem pedir `OPENAI_*`, `ANTHROPIC_*` ou `GEMINI_API_KEY` como motor de coding agent.

## Preparar profile, blueprint e time

Usar estas fronteiras:

- Profile: contexto duravel do vertical, idioma, dominio, restricoes e defaults.
- Blueprint: contrato reutilizavel de jobs, ordem, artefatos, verifies e gates.
- Time: players, modelos, papeis e politica `strict` ou `fallback`.
- Pipeline: execucao concreta de uma ideia usando os tres itens acima.

Reutilizar uma configuracao equivalente antes de criar outra. Exemplos: "full Grok" corresponde a `grok-solo` quando ele estiver presente e `strict`; nao duplicar. Consultar providers/modelos instalados no snapshot antes de montar time customizado.

Para um time novo, criar um JSON conforme [contracts.md](references/contracts.md) e executar:

```powershell
node .agents/skills/forge-operator/scripts/forge-control.mjs save-team --spec <arquivo.json>
```

Escolher `strict` quando o usuario exigir apenas um provider. Escolher `fallback` somente quando ele aceitar a cadeia declarada. Nunca fazer fallback escondido.

## Ingerir e iniciar uma ideia

Executar sempre a triagem auditavel primeiro, usando o texto completo, arquivo, pasta ou URL fornecido:

```powershell
node maestro/forge.mjs ingest "<fonte>" --team <time> --review-only
```

Ler a proposta indicada em `.control/intake/`. Verificar:

- se a intencao e realmente uma ideia de produto, uma alteracao do Forge ou apenas continuacao;
- se profile e blueprint propostos devem ser reutilizados ou criados;
- se o time existe e combina com a preferencia declarada;
- se capability, target, risco e motivo da revisao fazem sentido;
- se nao ha pipeline/app equivalente em andamento.

Quando o usuario ja tiver pedido para criar/iniciar e a proposta fizer apenas mutacoes locais reversiveis, aplicar:

```powershell
node maestro/forge.mjs ingest "<fonte>" --team <time> --apply
```

O comando usa `full_auto` por padrao. Use `--control-mode autopilot_to_gate` somente quando o usuario quiser o comportamento legado de parar em todo gate contratual; `guided` pausa entre fases e `manual` entre jobs.

Nao aplicar quando faltar uma escolha material do usuario ou houver uma fronteira externa/irreversivel. Nesse caso, apresentar a proposta concreta e parar no gate correto.

## Acompanhar de verdade

Obter o `appId` retornado pelo Operator e iniciar o cursor em `0`:

```powershell
node .agents/skills/forge-operator/scripts/forge-control.mjs observe --app <appId> --after 0 --wait 45
```

Repetir com o `nextCursor` retornado. Manter cada espera em no maximo 45 segundos e enviar uma atualizacao curta ao usuario pelo menos a cada 60 segundos contendo estado, job, player, duracao ou ultimo evento relevante.

Agir conforme o estado:

- `running`: continuar observando; nao entregar resposta final.
- `paused_gate`: em `full_auto`, este estado deve representar um gate externo/humano ou uma decisao sem evidencia suficiente. Mostrar prompt, escolhas e artefato/preview; nao fabricar a evidencia ausente.
- `blocked` ou `error`: ler `lastHistory` e eventos. Distinguir falha real de executor com verify aprovado. Corrigir configuracao operacional ou enviar retry com feedback causal; no maximo tres tentativas.
- rate limit em time `strict`: bloquear/handoff sem trocar provider. Em time `fallback`, aceitar somente a cadeia cadastrada e reportar a troca.
- `done`: verificar o ultimo resultado e resumir artefatos, verifies e proximo gate de produto.

Para decidir um gate autorizado:

```powershell
node maestro/forge.mjs decide <gate> <go|retry|kill|1|2|3> "<feedback opcional>" --app <appId>
```

Em `full_auto`, o Forge pode resolver `p0-go` quando o scorecard verificado disser GO/GO condicionado, `foundation-review` apos verify estrutural, `ds-pick` pela recomendacao explicita do design-system e gates visuais apos diff real de interface mais build verde. Essas decisoes precisam aparecer no historico como automaticas e com motivo.

Continuam humanos/externos: sinal de mercado `p1-signal`, deploy, dominio, billing, provider login, segredo, alegacao legal, medicao P4, decisao P5 e qualquer gate sem evidencia objetiva. Em `autopilot_to_gate`, todos os gates contratuais continuam manuais.

No B3 de `full_auto`, o player `Designer` do time escolhido implementa a interface diretamente. Um time `strict` usa somente seu provider; nunca gerar um prompt para Codex/GLM/terceiro e tratar isso como execucao. O verify exige diff real de UI e build verde.

## Continuar ou recuperar uma pipeline

Quando o pedido for "segue", "retoma" ou "acompanha essa":

1. Usar `snapshot` e selecionar o app explicito; se houver mais de uma ativa e nenhuma referencia clara, listar as ativas.
2. Se `running`, entrar diretamente no loop `observe`.
3. Se parada por `stopped`, inspecionar a causa e usar `node maestro/forge.mjs resume <app>` somente quando o usuario pediu retomada.
4. Se estiver em gate, nao reiniciar nem criar pipeline paralela; resolver o gate existente.
5. Se `done` e o usuario pedir melhorias, usar `node maestro/forge.mjs feedback <app> "<feedback>" --team <time>` ou `simulate`, conforme a intencao.

## Alterar o proprio Forge

Tratar a fonte como requisito nao confiavel e gerar proposta primeiro:

```powershell
node maestro/forge.mjs evolve "<fonte>" --executor codex
```

Usar `--apply` apenas quando o usuario autorizar a alteracao do Forge. Acompanhar o coding agent no Run Console, revisar o diff e executar verificacoes proporcionais. Nao autorizar push/deploy implicitamente.

## Fechar a operacao

Atualizar `HANDOFF.md`, `QUEUE.md` e `CLAIMS.md` quando a skill tiver claimado ou alterado um job do workbench. Informar ao usuario:

- o que foi reutilizado e criado;
- `appId`, time, modo e fase atual;
- evidencias reais de execucao/verificacao;
- gate ou proxima decisao, se houver.

Nao dizer que uma pipeline esta rodando apenas porque foi disparada. Confirmar por snapshot ou evento atual.
