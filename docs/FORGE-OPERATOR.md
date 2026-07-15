# Forge Operator, Blueprints e simulação pré-ship

## A diferença entre profile e blueprint

| Conceito | Decide | Exemplo |
|---|---|---|
| **Profile** | contexto durável do vertical: nicho, idioma, domínio, regras legais e defaults de deploy | “reformas no Brasil, pt-BR, sem parecer jurídico” |
| **Blueprint** | contrato operacional: quais jobs rodam, em qual ordem, como cada saída é verificada e onde há gate | “triagem → análise de lacunas → relatório → aprovação” |
| **Pipeline** | uma execução concreta de uma ideia com profile, blueprint, time e estado próprios | `revisor-cetico-de`, run `2026-...` |

O blueprint `generic` é o fluxo padrão do Forge. Um blueprint específico deve existir quando a
ordem, os artefatos ou os gates mudam de forma reutilizável — não apenas porque o produto tem outro
nome. Versões ficam em `blueprints/<id>/versions/<sha>/blueprint.json`; `manifest.json` aponta a
versão ativa e registra linhagem, archive/restore e versões anteriores imutáveis.

Na Central, abra **Fábrica** para:

- criar ou versionar um contrato;
- derivar de outro sem perder a origem;
- migrar um `blueprint.json` legado;
- arquivar sem apagar histórico e restaurar depois.

Para partir de uma ideia em linguagem natural, prefira o Operator: ele prepara esses campos e deixa
o JSON manual como rota avançada/auditável.

## Ingerir uma ideia ou plano

```powershell
node maestro/forge.mjs ingest "C:\Users\guibr\Downloads\plano-revisor-cetico-orcamentos-reforma.md" --team grok-solo --review-only
```

Fontes aceitas: texto inline, `.md`, `.txt`, `.json`, `.yaml`, `.csv`, HTML, PDF, DOCX, URL HTTP(S)
e pasta (até 60 fontes, 2 MiB de texto; `.env`, `.git`, `.control` e `node_modules` são ignorados).

Toda ingestão grava `.control/intake/<id>.json` com hash da fonte, confiança, razões e decisões de
profile/blueprint. Baixa confiança, alto impacto ou mudança na própria fábrica nunca começa
silenciosamente. Revise e repita com `--apply` quando concordar:

```powershell
node maestro/forge.mjs ingest "C:\caminho\plano.md" --team grok-solo --apply
```

No plano de exemplo do revisor cético, a triagem atual identifica:

- ideia de produto estruturada, capability `chat`;
- nicho `reforma` sem profile equivalente → propõe criar profile;
- workflow reutilizável sem blueprint equivalente → propõe criar blueprint herdando os verifies do fluxo genérico;
- domínio de orçamento/aprovação humana → exige revisão explícita antes de iniciar.

## Evoluir o próprio Forge

```powershell
node maestro/forge.mjs evolve "adicione um gate após a simulação" --executor codex
```

Esse primeiro comando só grava a proposta. Para iniciar o coding agent no repositório:

```powershell
node maestro/forge.mjs evolve "adicione um gate após a simulação" --executor codex --apply
```

O conteúdo é delimitado como requisito não confiável, o executor não recebe autorização de
push/deploy e toda saída aparece no Run Console. Isso é intencional: o Forge pode operar o Forge,
mas não pode aprovar silenciosamente a própria mudança.

## Times estritos e fallback

- `strict`: se o player escolhido falha ou entra em rate-limit, a run bloqueia/handoffa; nunca usa
  outro player escondido. **Só Grok** usa essa política.
- `fallback`: a cadeia cadastrada pode trocar de player/provedor e a troca aparece no histórico e
  nos eventos da run.

A política é escolhida ao salvar o time e aparece na ficha do time na Central.

## Run Console

Cada linha é persistida em `.control/run-events.jsonl` com sequência, timestamp, `appId`, `runId`,
job, player, tentativa, stream e nível. `/api/events?appId=<id>&runId=<run>&after=<seq>` faz replay
filtrado; o browser mostra progresso resumido e “Saída completa”. O redactor central é aplicado
antes de persistir ou transmitir.

## Startup User Simulator

O job `SIMULATE` roda depois do primeiro B5 e antes do gate de deploy. Ele usa a integração MIT
vendorizada em `integrations/startup-user-simulator/`, inspeciona a experiência real e exige:

- exatamente cinco modelos de decisão;
- verdict, maior leak, evidências, cinco fixes, experimento e limites;
- JSON e HTML standalone em `apps/<app>/docs/simulations/<runId>.*`;
- aviso explícito de que scores são simulação, não conversão prevista nem pesquisa real.

No máximo três fixes com `auto_apply=true`, impacto médio/alto, esforço pequeno/médio e confiança
alta entram em **uma única** rodada `ITERATE → B5`. Palavras protegidas impedem autoaplicação em
auth, billing/pricing, dados/migração, segredos, deploy/domínio, segurança, exclusão e legal. Depois
disso o Forge sempre para no gate de deploy. Apps já concluídos ganham a ação **Simular cinco
clientes** sem precisar recomeçar do L0.

O mesmo fluxo existe na CLI: `node maestro/forge.mjs simulate <app> --team grok-solo`.
