# Maestro Control Center

O Maestro é a central local do Forge: uma interface única para controlar a fábrica de P0 a P5 sem
usar terminal no fluxo normal. Ela abre apenas em `127.0.0.1:8799`, usa o estado real do engine e
nunca transforma o navegador em shell.

## Abrir com um clique

No Explorer, abra a pasta `C:\Dev\forge` e dê duplo clique em:

**`forge-control-center.cmd`**

O atalho:

1. confere se a porta 8799 responde como um Maestro legítimo;
2. reutiliza a instância saudável, sem duplicar servidor;
3. se necessário, inicia o servidor minimizado;
4. espera o health real;
5. abre o navegador uma única vez.

Se outra aplicação ocupar a porta, o launcher falha fechado e explica o problema. Ele não mata
processos e não reinicia uma pipeline viva.

## O mapa da central

| Área | O que você resolve nela |
|---|---|
| **Visão geral** | Saúde, trabalho ativo, providers, operações e gates que exigem atenção. |
| **Nova pipeline** | Ideia, time, profile, blueprint, capability, target, dry-run e modo de controle. |
| **Pipelines** | Timeline P0–P5, job atual, erro recente, target, recovery e ações válidas por app. |
| **Decisões** | Gates humanos, documentos, três propostas de design, preview e P5. |
| **Fábrica** | Profiles, times, providers instalados, login oficial e blueprints. |
| **Métricas** | P4 comparável, receita, custo, ativação, conversão e decisões kill/iterate/scale. |
| **Atividade** | Operações idempotentes e eventos ao vivo, com resultado ou erro sanitizado. |

## Criar a primeira pipeline

1. Abra **Nova pipeline**.
2. Descreva a ideia e quem pagaria por ela.
3. Escolha um time. Use `dry-run` quando quiser validar o fluxo sem gastar quota.
4. Selecione profile/blueprint quando o caso exigir; `generic` e `auto` servem como padrão.
5. Escolha o modo de controle:
   - **full_auto (padrão):** decide gates locais verificados, escolhe o design recomendado, implementa B3 e para somente em sinal externo, blocker ou deploy;
   - **autopilot_to_gate:** comportamento legado; avança entre jobs, mas para em todo gate contratual;
   - **guided:** também pausa nas fronteiras de fase;
   - **manual:** pausa depois de cada job.
6. Clique em **Iniciar pipeline**.

O app aparece em **Pipelines**. A central mostra apenas as ações aceitas naquele estado; quando uma
ação estiver bloqueada, o motivo vem do backend e aparece junto ao botão.

## Decisões e risco

As ações carregam quatro níveis:

- **segura:** leitura, refresh ou continuação reversível;
- **com atenção:** muda configuração ou estado, mas preserva o produto;
- **efeito externo:** abre autenticação ou prepara interação fora da máquina;
- **destrutiva:** encerra run ou remove estado/arquivos.

Efeito externo e destrutivo sempre abrem uma confirmação contextual. O aceite gera um nonce de uso
único preso à ação, app e versão do estado. Se a fábrica mudar enquanto o modal estiver aberto, a
central recarrega o snapshot e pede nova revisão.

Gates contratuais continuam humanos em qualquer modo. A central nunca autoriza deploy, kill,
escolha de design ou outra decisão irreversível por conta própria.

## Configurar a fábrica

Em **Fábrica**:

- crie ou ative um profile para nicho, idioma e domínio;
- monte um time escolhendo provider, modelo, effort e papel de cada músico;
- atualize a disponibilidade das CLIs;
- abra apenas os logins oficiais allowlisted;
- confira os blueprints e a quantidade de jobs.

Credenciais nunca passam pelo formulário. O fluxo de login pertence à CLI oficial e o navegador não
escolhe binário, argumento ou caminho.

## Recuperar erro sem terminal

Abra a pipeline afetada e leia **Erro recente**. Conforme o estado, o catálogo pode oferecer:

- parar com segurança e preservar artefatos;
- responder o gate de recovery;
- retomar uma pipeline bloqueada;
- trocar target;
- mudar o modo de controle;
- continuar uma pausa guided/manual;
- iterar com feedback depois de uma run concluída.

Rate-limit continua sendo tratado pelo engine: cooldown global e fallback do time. A central apenas
mostra o estado e as escolhas permitidas; não contorna as proteções.

## Fechar o ciclo P4/P5

Quando um app estiver no pós-ship, abra suas ações e registre P4 com zeros honestos quando não houver
dado. Depois escolha:

- **kill:** aposenta a aposta sem apagar produção;
- **iterate:** abre um novo ciclo com feedback;
- **scale:** registra o sinal e os próximos passos.

Os agregados aparecem em **Métricas**. Nada é estimado pelo dashboard: sem medição, ele mostra zero
ou estado vazio.

## Limites de segurança

- local-only, sem CORS aberto e sem painel remoto;
- token same-origin em toda mutação;
- nenhuma ação de shell livre;
- estado versionado, idempotência e auditoria redigida;
- operações e lifecycle em arquivos locais privados/atômicos;
- nenhum deploy acontece só por abrir a central.

O `forge.cmd` e a TUI continuam disponíveis como fallback técnico, mas não são necessários para o
uso normal do Control Center.
