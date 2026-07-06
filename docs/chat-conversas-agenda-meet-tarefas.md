# Chat / Conversas — agenda, Meet e tarefas

## Regra implementada

A tela de Chat / Conversas pode iniciar ações relacionadas à pessoa da conversa, mas cada tipo segue seu fluxo correto.

## Ações disponíveis

### Agendar ligação / reunião por Meet

- Usa Google Meet.
- Registra o evento em `/api/chat/schedules` como `meeting` com `meet: true`.
- Vincula criador e pessoa convidada como participantes.
- Envia mensagem de sistema na conversa com o resumo da reunião.
- Adiciona link para abrir Google Meet.
- Abre o Google Calendar em modo template para criação/associação do evento externo.
- Espelha o evento na agenda interna pelo fluxo já existente da API de schedules.

### Agendar compromisso com a pessoa

- Usa fluxo interno do sistema.
- Registra o evento em `/api/chat/schedules` como `internal_appointment`.
- Não abre Google Meet.
- Envia mensagem de sistema na conversa.
- Redireciona para agenda interna do dia criado.

### Criar tarefa para a pessoa

- Usa fluxo interno do sistema.
- Registra o item em `/api/chat/schedules` como `task`.
- Não depende de Google Meet.
- Relaciona a tarefa com a conversa e a pessoa selecionada.
- Gera mensagem de sistema e notificação interna conforme o fluxo de agenda/tarefa.

## Separação externa x interna

Google Meet é usado somente quando a ação é `meet`.

Todo o restante permanece interno:

- agenda interna;
- agendamentos gerais da empresa;
- visualização de compromissos;
- tarefas;
- notificações internas;
- vínculo com a conversa.

## Validação manual

1. Abrir `/chat`.
2. Selecionar uma pessoa.
3. Usar o botão `Meet` e confirmar que abre formulário de Meet.
4. Salvar e confirmar registro no chat, agenda interna e abertura do Calendar/Meet.
5. Usar `Compromisso` e confirmar que não abre Google Meet.
6. Usar `Tarefa` e confirmar que não abre Google Meet.
7. Verificar agenda interna/meus agendamentos e agenda geral da empresa.
