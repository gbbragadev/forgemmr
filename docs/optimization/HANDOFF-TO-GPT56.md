# HANDOFF → GPT-5.6 Sol Ultra

**De:** Claude Fable 5 (arquiteto/auditor, Modo A)
**Para:** GPT-5.6 Sol Ultra (implementador)
**Data:** 13/07/2026 · **Branch:** `master` · **Repo:** `C:\Dev\forge`

| | commit | o que é |
|---|---|---|
| **Auditado** | `0423528` | o código que eu li e medi. Todo finding aponta para linhas **deste** commit, e é contra ele que um teste novo tem de falhar (`git stash` + `git checkout 0423528 -- maestro/` para conferir, se quiser). |
| **Parta daqui** | **`master` (HEAD)** | o mesmo código de produção + `docs/optimization/` + `characterization.test.mjs`. **Não faça checkout de `0423528`** — você perderia o contrato. |

Entre os dois só entraram **docs e testes**: o código de produção é byte-idêntico
(`git diff 0423528..HEAD -- maestro/*.mjs packages/ apps/` = vazio).

---

## 1. O que é este trabalho em uma frase

O ForgeMMR é uma fábrica de apps que **funciona** — e está apontada para o alvo errado. Sua tarefa
não é reescrevê-la: é (a) parar quatro formas de ela se sabotar, e (b) fazer com que ela pergunte
**quem paga** antes de construir, e **meça** depois de lançar.

O dono está sem emprego e quer receita recorrente com **produtos**, não com a pipeline. Toda tarefa
deste contrato existe por causa disso. Se uma mudança sua não aumenta a chance de alguém pagar por
um app que saiu daqui, ela não pertence a este pacote.

## 2. Ordem de leitura (não pule)

1. **`docs/optimization/04-IMPLEMENTATION-CONTRACT.md`** ← seu contrato. Tem o código a escrever.
2. `docs/optimization/01-FABLE-AUDIT.md` §3 — a evidência de cada finding (leia o do item que for
   implementar; não precisa dos outros).
3. `docs/optimization/03-MASTER-PLAN.md` §3 — as ondas e a definição de pronto de cada uma.
4. `AGENTS.md` + `README.md` — as regras da casa (loops, verify objetivo, gates, git por app).
5. `docs/optimization/00-RESEARCH-CONTEXT.md` §4 — **o que NÃO fazer**, e por quê. Leia antes de ter
   uma boa ideia fora do escopo.

## 3. Comandos iniciais

```bash
cd C:\Dev\forge
git log -1 --format=%h          # deve ser 759bb99 (NÃO faça checkout de 0423528)
npm test                        # baseline: 63 PASS (59 + 4 de caracterização), ~16s
npm run typecheck               # exit 0 (~3 min)
npm run build:all               # HOJE FALHA — é a tarefa T-01
npm run forge -- new "probe" --team dry-run --dry-run   # E2E sem quota; depois: forge remove probe --force
```

**Estado do working tree:** limpo, exceto `package-lock.json` (modificação pré-existente, **não
mexa**). Há um servidor do maestro vivo na porta 8799 (PID pode mudar) — **não o mate**; se
precisar reiniciar, use `npm run forge -- restart` (ele recusa se houver job vivo).

## 4. Ordem de implementação

```
T-14 (CI)  →  T-01 (build:all)                    ← Onda 0: rede de segurança
T-03 (rate-limit)  →  T-04 (atômico)  →  T-02 (gh-pages)
   →  T-06 (fallback)  →  T-05 (cooldown global)  →  T-07 (errorTail)   ← Onda 1
T-08 (P0 Mercado)  →  T-09 (gate condicionado)  →  T-13 (doki-call)  →  T-10a (beacon)  ← Onda 3
T-11 (injection)  →  T-16 (cache improver)  →  T-15 (verify)  →  T-12 (pin)  →  T-20 (borda)  ← Onda 2
T-10b (P4 JSON)  →  T-17 (forge stats)            ← Onda 4
```

**T-03 antes de T-05.** Se você inverter, o cooldown global passa a propagar o **falso positivo** de
rate-limit para todas as pipelines de uma vez — uma regressão pior que o bug original. Está na
checklist de revisão como MUST FIX.

## 5. Invariantes (violar = rejeitado na revisão)

| # | Invariante |
|---|---|
| I-1 | Nenhum executor de coding usa API paga por chamada (só CLI de assinatura) |
| I-2 | Git de run acontece **dentro** de `apps/<app>/.git`; a fábrica só commita `workbench/` |
| I-3 | Guards anti-walk-up de git permanecem (`engine.mjs:458`, `:468`) |
| I-4 | Dry-run não gasta quota nem publica |
| I-5 | Gate humano continua no irreversível (deploy, kill, escolha de design) |
| I-6 | Segredo nunca em log, raw log ou commit |
| I-7 | N pipelines rodam concorrentes sem disputar working tree |
| I-8 | `npm test` verde ao fim de **cada** tarefa |
| I-9 | Os 4 testes de `maestro/test/characterization.test.mjs` continuam passando — se um quebrar, é comportamento observável mudando: **justifique por escrito** (T-07 quebra um de propósito) |

## 6. Você decide sozinho

- Nomes de arquivos, funções e testes novos (siga o estilo do repo: `node:test`, sem framework).
- Estrutura interna dos testes, desde que **falhem no commit-base** e passem depois.
- Como acessar `buildPrompt` para testá-lo (exportar é aceitável).
- O destino durável do beacon em produção (T-10a) — **desde que não introduza serviço/banco novo** e
  você documente a escolha.
- Ordem **dentro** de uma onda (exceto T-03 → T-05).
- Refinar o regex de rate-limit além do que sugeri, se você tiver caso melhor — **mantendo** os 8
  casos de teste passando.

## 7. Exige autorização do dono (PARE e pergunte)

- **Qualquer deploy / publicação.** T-13 mexe num app **em produção** (`doki-call.gbbragadev.com`):
  commite no repo do app, **não publique**.
- Rotacionar, criar ou pedir credencial (Cloudflare, Vercel, Stripe, chaves de Realtime).
- Editar `maestro/roster.json` (é estado do usuário — times que ele montou).
- Apagar app, branch de pipeline, ou qualquer coisa em `maestro/pipelines/` e `maestro/runs/`.

> ### ⛔ `forge remove` — leia antes de digitar
>
> `removeApp` (`engine.mjs:1630`) **não tem gate e não distingue probe de produção**: ele apaga
> `apps/<app>`, `maestro/pipelines/<app>.json` e `maestro/proposals/<app>` e pronto (F-29).
>
> **Estes quatro apps são INTOCÁVEIS** — três estão no ar:
> `doki-call` · `anima-deck` · `anime-quiz` · `waifu-chat`
>
> Você só pode remover **o app-probe que você mesmo criou** no dry-run, com o nome exato que você
> deu a ele. Confira o `appId` **antes** de apertar enter. Um typo aqui é irreversível.
- Integrar PSP real (Stripe/Pix) — é decisão de negócio, não de engenharia.
- Adicionar dependência nova, banco, fila ou serviço externo. (Resposta esperada: não. Ver
  `00-RESEARCH-CONTEXT.md` §4.)

## 8. Riscos conhecidos deste trabalho

1. **T-08 e T-15 endurecem o `verify`** — e o `fake-exec` alimenta o dry-run. Se você endurecer o
   verify sem atualizar o fake, **a suíte inteira quebra**. Se afrouxar o fake para "fazer passar", o
   gate deixa de existir (a revisão procura exatamente isso).
2. **T-03 mexe na classificação de erro.** Se algum provedor imprime rate-limit e sai com exit 0, o
   L2 deixa de disparar para ele. Confira antes: `grep -ril "429\|rate limit" maestro/runs/ | head`.
3. **T-05 muda estado compartilhado.** Não apague `pipeline.cooldowns` no mesmo commit — o cockpit e
   o snapshot o consomem.
4. **Windows.** `cmd.exe` não entende `;`. Não use `pkill`, `/tmp`, nem paths com `/`.
5. **O GitHub Actions vai ficar vermelho a cada push que você der — e não é culpa sua.**
   `deploy-anime-quiz.yml` roda `on: push → master` e falha com `No workspaces found` desde a
   migração repo-por-app (o runner clona a fábrica, que **ignora `apps/`** — F-28). **Não conserte
   esse workflow**: o que fazer com ele é decisão do dono (o `anime-quiz` está publicado). Só não
   confunda esse vermelho pré-existente com uma quebra sua — e, ao criar o CI da T-14, faça-o num
   workflow **separado**, para que o verde dele signifique alguma coisa.

## 9. Definição global de pronto

- [ ] Todas as tarefas P0/P1 do contrato implementadas, **cada uma com teste que falhava no
      commit-base**
- [ ] `npm test` verde (≥ 63 + os testes novos)
- [ ] `npm run build:all` exit 0 · `npm run typecheck` exit 0
- [ ] Dry-run E2E chega ao gate `p0-go` sem erro
- [ ] Nenhuma dependência nova, nenhum serviço novo, nenhuma reescrita
- [ ] Nenhum deploy feito
- [ ] `docs/optimization/GPT56-VERIFICATION-REPORT.md` escrito, **com a saída real dos comandos
      colada** (não "passou")
- [ ] `docs/optimization/HANDOFF-TO-FABLE-REVIEW.md` escrito, com commit-base, head, arquivos
      tocados, o que ficou de fora e **onde você tem dúvida**

A existência desses dois arquivos coloca o Fable 5 em Modo B (revisão adversarial) automaticamente.
Ele vai tentar quebrar o que você fez — inclusive rodando os comandos de novo. Facilite: cole
saída real, admita o que não fez, e diga onde está inseguro.

---

## 10. O que eu faria primeiro se fosse você

`T-01` (dez minutos, e devolve o comando que prova que nada quebrou) e `T-03` (o bug que joga fora
trabalho bom do agente e mente no log dizendo que foi rate-limit). Os dois juntos mudam a
confiabilidade da fábrica mais do que qualquer feature deste pacote.

Depois **pare na T-08** e leia o scorecard que a fábrica gerar. Se o campo "Comprador" vier
preenchido com "público jovem que gosta de anime", o gate não está filtrando nada — e você
descobriu isso antes de o dono gastar mais cinco jobs de modelo caro.
