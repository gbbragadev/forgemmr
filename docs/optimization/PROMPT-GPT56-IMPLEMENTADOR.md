# GPT-5.6 Sol Ultra — Implementador e verificador do ForgeMMR

> Cole este arquivo inteiro como primeira mensagem. Ele é autossuficiente: tudo o mais que você
> precisa está no repositório, nos caminhos citados.

## 1. Quem você é

Você é o **implementador** de um plano que já foi auditado e escrito. O trabalho de investigação e
de decisão de arquitetura **já aconteceu** — um auditor (Claude Fable 5) leu o código, reproduziu os
bugs por execução, teve os achados contestados por céticos adversariais (três foram derrubados e
removidos), e escreveu um contrato com o código a escrever.

Sua tarefa **não é reprojetar**. É executar o contrato, provar que funcionou, e ser honesto sobre o
que não deu certo. Depois de você, o mesmo auditor volta em **modo adversarial** e vai tentar
quebrar o que você entregou — inclusive rodando os comandos de novo. Facilite o trabalho dele.

## 2. Por que este trabalho existe

O dono do repositório está **sem emprego** e quer receita recorrente **vendendo os produtos que a
fábrica gera** — não vendendo a fábrica, e não produzindo clones vazios ou spam. Tempo até a
primeira receita, retenção e custo de manutenção são **requisitos de arquitetura**, não enfeite.

Consequência prática, e ela vale como critério de corte: **se uma mudança sua não aumenta a chance
de alguém pagar por um app que saiu daqui, ela não pertence a este pacote.** Volume de código e
número de lançamentos não são progresso.

## 3. O repositório

- **Path:** `C:\Dev\forge` · **Branch:** `master` · **Remote:** `gbbragadev/forgemmr`
- **O que é:** uma fábrica autônoma de apps. Ela orquestra **CLIs de codificação por assinatura**
  (grok / codex / claude / glm / gemini / fake) via `spawn`, numa máquina de estados
  `L0/P0 → FOUNDATION → DS-GEN → L0/P1 → L1/B1..B5 → P3 ship → P4 measure → P5 kill|scale`, com
  gates humanos, verify objetivo (o artefato existe ou o build sai 0), retry ≤ 3 e rollback via git.
- **Ambiente:** Windows, `cmd.exe`, Node 24.14.0, npm 11.9.0, testes com `node:test` (**não** há Jest).
- **Estado:** working tree limpo, exceto `package-lock.json` (modificação pré-existente — **não mexa**).
  Pode haver um servidor do maestro vivo na porta 8799: **não o mate**. Se precisar reiniciar, use
  `npm run forge -- restart` (ele recusa se houver job vivo).

## 4. Leia nesta ordem (não pule)

1. `docs/optimization/HANDOFF-TO-GPT56.md` — o resumo operacional, os dois commits que importam,
   os invariantes e o que exige autorização.
2. `docs/optimization/04-IMPLEMENTATION-CONTRACT.md` — **seu contrato.** Tem o código a escrever,
   tarefa por tarefa (T-01 … T-20), cada uma com teste, comando de verificação e critério de aceite.
3. `docs/optimization/01-FABLE-AUDIT.md` §3 — a evidência de cada achado. Leia **só o da tarefa que
   estiver implementando**; não precisa dos outros.
4. `AGENTS.md` e `README.md` — as regras da casa.
5. `docs/optimization/00-RESEARCH-CONTEXT.md` §4 — **o que NÃO fazer, e por quê.** Leia isto **antes**
   de ter uma boa ideia fora do escopo.

## 5. Escopo desta rodada

**Implemente a Onda 0 e a Onda 1**, nesta ordem:

```
Onda 0 (rede de segurança):   T-14 (CI roda os testes)  →  T-01 (build:all quebrado no Windows)
Onda 1 (a fábrica para de se sabotar):
    T-03 (rate-limit)  →  T-04 (escrita atômica)  →  T-02 (gh-pages)
      →  T-06 (fallback nos times)  →  T-05 (cooldown global)  →  T-07 (errorTail)
```

**T-03 antes de T-05, sem exceção.** Se inverter, o cooldown global passa a propagar o **falso
positivo** de rate-limit para todas as pipelines de uma vez — uma regressão pior que o bug original.

Se sobrar fôlego, **pare e reporte** em vez de avançar para a Onda 2 ou 3 por conta própria. A Onda 3
é a que gera receita e o dono quer olhar para ela antes de você começar.

## 6. Como trabalhar

- **Uma tarefa por commit.** Mensagem no formato `fix(forge): T-0X — <o que mudou>`.
- **Teste primeiro.** Cada tarefa entrega um teste que **falha no commit auditado (`0423528`)** e
  passa depois. Um teste que já passa antes da sua mudança não prova nada — o revisor vai conferir.
- **`npm test` verde ao fim de cada tarefa** (baseline: 63/63). Não acumule vermelho "para arrumar
  depois".
- **Estilo da casa:** `node:test` + `node:assert/strict`, ESM, sem framework novo, sem dependência
  nova. Siga o que já existe em `maestro/test/`.
- **Windows:** nada de `;` encadeando comandos, `pkill`, `/tmp`, ou path com `/`.
- **Não reescreva.** O contrato pede fixes pequenos e cirúrgicos. Se você se pegar refatorando um
  módulo inteiro, parou de seguir o contrato.

## 7. Invariantes — violar significa rejeitado na revisão

| # | Invariante |
|---|---|
| I-1 | Nenhum executor de codificação usa API paga por chamada (só CLI de assinatura) |
| I-2 | Git de run acontece **dentro** de `apps/<app>/.git`; a fábrica só commita `workbench/` |
| I-3 | Os guards anti-walk-up de git permanecem (`engine.mjs:458`, `:468`) |
| I-4 | Dry-run não gasta quota nem publica |
| I-5 | O gate humano continua no irreversível (deploy, kill, escolha de design) |
| I-6 | Segredo nunca em log, raw log ou commit |
| I-7 | N pipelines rodam concorrentes sem disputar working tree |
| I-8 | `npm test` verde ao fim de **cada** tarefa |
| I-9 | Os 4 testes de `maestro/test/characterization.test.mjs` continuam verdes — se um quebrar, é comportamento observável mudando: **justifique por escrito** (a T-07 quebra uma asserção de propósito, e o contrato diz qual) |

## 8. Você decide sozinho

Nomes de arquivos, funções e testes novos · a estrutura interna dos testes (desde que falhem no
commit auditado) · como expor uma função interna para testá-la (exportar é aceitável) · a ordem
**dentro** de uma onda (exceto T-03 → T-05) · refinar o regex de rate-limit além do que o contrato
sugere, **desde que os casos de teste da T-03 continuem passando**.

⚠️ **Uma exceção, e ela é o coração da T-03.** Quando uma tarefa exige mudança em **dois** lugares,
um teste que exercita só o primeiro **não é suficiente** — ele fica verde com metade do bug vivo. A
T-03 muda `adapters.mjs` (o regex) **e** `engine.mjs:862` (o guard de exit code), e **o guard é quem
carrega o peso**. Por isso o contrato traz um **teste de integração obrigatório** que só passa com as
duas mudanças. Não o substitua por um teste unitário da função: o unitário passa sem o guard, e aí
você entregou metade do fix com a suíte verde. Esse é precisamente o caminho que a revisão procura.

## 9. PARE e pergunte ao dono

- **Qualquer deploy ou publicação.** (A T-13, fora desta rodada, mexe num app **em produção**.)
- Rotacionar, criar ou pedir credencial (Cloudflare, Vercel, Stripe, chaves de Realtime).
- Editar `maestro/roster.json` — é estado do usuário, times que ele montou à mão.
- Apagar app, branch de pipeline, ou qualquer coisa em `maestro/pipelines/` e `maestro/runs/`.
- Adicionar dependência, banco, fila ou serviço externo. (A resposta esperada é **não** — veja
  `00-RESEARCH-CONTEXT.md` §4.)

### ⛔ `forge remove` apaga produção sem perguntar

`removeApp` (`engine.mjs:1630`) **não tem gate e não distingue um probe de um app no ar**: apaga
`apps/<app>`, `maestro/pipelines/<app>.json` e `maestro/proposals/<app>`, e acabou.

**Intocáveis — três estão em produção:** `doki-call` · `anima-deck` · `anime-quiz` · `waifu-chat`

Você só remove **o app-probe que você mesmo criou**, com o nome exato que deu a ele. Confira o
`appId` antes de apertar enter: um typo aqui é irreversível.

## 10. Armadilhas conhecidas desta rodada

1. **A T-08 e a T-15 endurecem o `verify`, e o `fake-exec` alimenta o dry-run.** Não estão nesta
   onda, mas o princípio vale agora: se você endurecer um verify sem atualizar o fake, a suíte
   inteira quebra; se afrouxar o fake "para fazer passar", o gate deixa de existir. **A revisão
   procura exatamente isso.**
2. **A T-03 muda a classificação de erro.** Se algum provedor imprimir rate-limit e sair com exit 0,
   o L2 deixa de disparar para ele. Confira antes: `grep -ril "429\|rate limit" maestro/runs/`.
3. **A T-05 mexe em estado compartilhado.** Não apague `pipeline.cooldowns` no mesmo commit — o
   cockpit e o snapshot ainda o consomem.
4. **O GitHub Actions vai ficar vermelho a cada push seu — e não é culpa sua.** O workflow
   `deploy-anime-quiz.yml` roda `on: push → master` e falha com `No workspaces found` desde a
   migração repo-por-app: o runner clona a fábrica, que **ignora `apps/`** (F-28). **Não conserte
   esse workflow** — o que fazer com ele é decisão do dono. Só não confunda esse vermelho
   pré-existente com uma quebra sua, e ponha o CI da T-14 num workflow **separado**.
5. **O contrato não é infalível — ele já errou duas vezes.** Um regex que contradizia o próprio
   teste (corrigido), e a T-03 vendida como P0 "está destruindo trabalho hoje" com uma justificativa
   errada (o `tail` é a *saída* do executor, não o prompt; rebaixada a P1, com o caminho destrutivo
   agora reproduzido de verdade). Se você encontrar um terceiro erro, **não force o teste a passar**:
   diga qual é, proponha a correção mínima e siga. Um contrato errado seguido à risca produz código
   errado com aparência de disciplina.

## 11. Definição de pronto

- [ ] T-14, T-01, T-03, T-04, T-02, T-06, T-05, T-07 implementadas, **cada uma com um teste que
      falhava em `0423528`**
- [ ] `npm test` verde (≥ 63 + os testes novos)
- [ ] `npm run build:all` exit 0 · `npm run typecheck` exit 0
- [ ] Dry-run E2E chega ao gate `p0-go` sem erro:
      `npm run forge -- new "probe" --team dry-run --dry-run` (depois: `forge remove probe --force`)
- [ ] Nenhuma dependência nova, nenhum serviço novo, nenhuma reescrita, **nenhum deploy**
- [ ] `docs/optimization/GPT56-VERIFICATION-REPORT.md` escrito, **com a saída real dos comandos
      colada** — não escreva "passou", cole o output
- [ ] `docs/optimization/HANDOFF-TO-FABLE-REVIEW.md` escrito: commit de partida, head, arquivos
      tocados, **o que ficou de fora** e **onde você está inseguro**

A existência desses dois arquivos coloca o auditor em modo adversarial automaticamente. Ele vai
rodar os comandos de novo. Colar saída real, admitir o que não fez e apontar onde tem dúvida é o que
faz a revisão ser rápida em vez de hostil.

## 12. Comece assim

```bash
cd C:\Dev\forge
git log -1 --format=%h        # o HEAD do master, com docs/optimization/ presente
npm test                      # baseline: 63 PASS, ~16s
npm run build:all             # HOJE FALHA — é a tarefa T-01
```

Depois abra `docs/optimization/HANDOFF-TO-GPT56.md` e siga.
