# Forge Nexus — guia operacional sem terminal

O Forge Nexus é a central local do Forge. Ele reúne criação de pipelines, acompanhamento, gates humanos, configuração da fábrica, métricas, memória e auditoria em uma interface única.

O controle real fica em `http://127.0.0.1:8799`. Esse endereço responde somente na sua máquina. O tutorial público é apenas documentação estática: ele não lê pipelines, memória, tokens nem arquivos locais.

## 1. Abrir a central

1. Abra a pasta do Forge no Explorador de Arquivos.
2. Dê duplo clique em `forge-control-center.cmd`.
3. Aguarde o navegador abrir o Forge Nexus.
4. Confirme o indicador **Nexus online** no rodapé da barra lateral.

O launcher reutiliza uma instância saudável. Se encontrar uma central antiga, ele a abre como legada e avisa que um restart seguro é necessário; ele não encerra um processo desconhecido nem disputa a porta.

## 2. Entender as oito áreas

| Área | Para que serve |
|---|---|
| Visão geral | Mostra trabalho ativo, decisões pendentes e o próximo movimento seguro. |
| Nova pipeline | Transforma uma ideia em uma execução configurada, sem sintaxe manual. |
| Pipelines | Mostra progresso P0–P5, verify, erro recente, memória contextual e ações válidas. |
| Decisões | Reúne gates humanos com contexto, escopo e efeito esperado. |
| Fábrica | Administra profiles, times, providers e blueprints. |
| Métricas | Consolida P4 e as decisões P5 de matar, iterar ou escalar. |
| Memória | Instala, busca, importa, revisa e mantém o contexto durável. |
| Atividade | Exibe operações sanitizadas e eventos em tempo real. |

## 3. Criar a primeira pipeline

1. Abra **Nova pipeline**.
2. Descreva a ideia e o app.
3. Escolha profile, blueprint, time e modo de controle.
4. Para conhecer o fluxo sem quota nem publicação, use o time de dry-run.
5. Revise o resumo e clique em **Criar pipeline**.

A pipeline percorre:

- **P0 — Mercado:** quem paga, por qual canal, por quanto e com que recorrência.
- **Foundation e DS-GEN:** arquitetura e direção visual verificáveis.
- **P1 — Conteúdo:** hooks e proposta antes do build completo.
- **B1–B5 — Build:** implementação, conteúdo, UI, integrações e ship check.
- **P3 — Ship:** publicação após gate humano.
- **P4 — Measure:** visitas, ativação, conversão, receita e custo reais.
- **P5 — Decide:** kill, iterate ou scale.

O Forge Nexus segue sozinho nos trechos reversíveis e para nos gates contratuais. O modelo executa uma iteração; o estado persistido conduz o processo.

## 4. Instalar memória visualmente

1. Abra **Memória**.
2. No cartão de saúde, clique em **Configurar memória**.
3. Aguarde o estado mudar para **healthy**.

A instalação baixa a release pinada do `ai-memory`, valida SHA-256 e inicia o processo em `127.0.0.1:49374`. O token interno e os dados ficam fora do checkout. O runtime recebe um ambiente mínimo, sem credenciais de provedores de IA.

Se você não quiser instalar agora, escolha **Continuar sem memória** simplesmente seguindo para outra área. A fábrica funciona sem briefing recuperado.

## 5. Importar histórico com prévia

1. Em **Memória**, clique em **Analisar fontes seguras**.
2. Revise a lista descoberta.
3. Desmarque qualquer item que não deve virar contexto.
4. Clique em **Importar selecionados**.

A allowlist cobre README, documentação, handoff, fila e resumos sanitizados de pipelines. Arquivos de ambiente, logs crus, diretórios de dependências, symlinks e arquivos grandes não entram. A prévia expira se a fonte mudar antes da aplicação.

O checkpoint fica fora do repositório. Repetir a mesma importação não duplica conteúdo; uma fonte alterada ganha um novo hash e pode ser importada novamente.

## 6. Usar briefing, busca e fontes

Escolha o escopo **Fábrica** ou um app. A memória nunca mistura resultados entre apps.

- **Busca:** procure por uma decisão, erro, resultado ou regra e filtre por tipo.
- **Briefing do próximo job:** veja exatamente quais fontes podem entrar no contexto.
- **Linha do tempo:** confira páginas recentes, regras, slots e alertas de saúde.
- **Pipelines:** abra o painel contextual para ver as referências usadas no último briefing.

Cada fonte mostra origem, projeto e data. Conteúdo recuperado entra no prompt dentro de um bloco explicitamente não confiável. Ele é dado para avaliação, não instrução operacional.

### Promover uma regra

Observações e resultados nunca viram regra automaticamente.

1. Clique em **Promover regra**.
2. Escolha fábrica ou app.
3. Escreva uma regra clara.
4. Anexe evidências e escolha a sensibilidade.
5. Revise o efeito e confirme.

### Excluir uma página

A exclusão é destrutiva. O Forge Nexus preenche o app e o caminho a partir do resultado selecionado, mostra o escopo, exige checkbox de confirmação e usa um nonce preso à versão do estado.

## 7. Memória degradada e continuidade

Uma falha de memória não bloqueia pipeline, gate nem verify.

Quando o estado estiver **degraded**:

1. Leia o erro sanitizado no cartão de saúde.
2. Clique em **Tentar novamente**.
3. Se não recuperar, continue trabalhando normalmente.

Novas lembranças entram numa outbox JSONL privada. A fila sobrevive a restart, deduplica registros e drena quando o processo volta a ficar saudável.

## 8. Backup e reindexação

### Criar backup

Use **Criar backup** antes de manutenção ou mudança importante. O arquivo recebe data, fica no diretório privado do Forge Nexus e não entra no git.

### Reconstruir índice

Use **Reconstruir índice** quando a wiki existe, mas derivados ou busca precisam ser refeitos. A ação:

1. exige que o processo saudável seja gerenciado pelo Forge Nexus;
2. pede confirmação destrutiva;
3. para somente o processo que a própria central iniciou;
4. reconstrói o índice a partir da wiki preservada;
5. reinicia e confirma health.

## 9. Tomar decisões nos gates

Abra **Decisões**. Cada cartão traz descrição, contexto, efeito esperado e somente as escolhas válidas no estado atual.

- **P0:** valide mercado antes de gastar build.
- **B3:** compare propostas visuais antes de escolher.
- **P3:** confirme destino e efeito externo antes de publicar.
- **P5:** use sinal real para matar, iterar ou escalar.

Se o estado mudar enquanto o cartão está aberto, a ação falha fechada, a central atualiza e pede nova revisão.

## 10. Resolver problemas sem comandos

| Situação | Onde ir | O que fazer |
|---|---|---|
| Memória não saudável | Memória | Ler o erro e clicar em Tentar novamente; continuar sem memória se necessário. |
| Provider em rate-limit | Pipelines / Fábrica | Acompanhar cooldown e fallback; não reiniciar o produto. |
| Verify reprovado | Pipelines | Ler Erro recente e escolher a ação válida de retry, fallback ou bloqueio. |
| Gate aguardando | Decisões | Revisar contexto, escopo e efeito antes de escolher. |
| Ação ficou obsoleta | Qualquer área | Aceitar a atualização automática e revisar novamente. |
| Precisa interromper | Pipelines | Usar a ação de pausa ou kill exibida para aquele estado. |
| Quer apagar | Pipelines / Memória | Distinguir encerrar de excluir e confirmar o escopo destrutivo. |

## 11. Privacidade e limites

- Forge Nexus: `127.0.0.1:8799`, somente loopback.
- ai-memory: `127.0.0.1:49374`, somente loopback e autenticado internamente.
- O dashboard não recebe um campo de terminal, comando, executável, URL ou argumentos livres.
- Logs, respostas, outbox e importação passam por redaction.
- A memória é Zero-LLM por padrão: não usa API paga por chamada.
- Hooks globais e provider LLM do upstream continuam opcionais e desligados.
- O tutorial público não chama localhost e não contém tokens.

## 12. Antes de publicar

Na área **Decisões**, confira:

- mercado completo;
- verifies verdes;
- visual aprovado;
- scan de segredos vazio;
- briefing e fontes revisados;
- target correto;
- rollback ou backup disponível;
- efeito externo entendido.

Depois do ship, registre P4 com números reais e use P5 para decidir o destino da aposta. Volume de lançamentos não substitui receita, retenção e manutenção sustentável.
