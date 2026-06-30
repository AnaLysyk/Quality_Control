# Contrato — Empresa, Meu Perfil, Solicitar Acesso e Qase

## Objetivo

Garantir que o cadastro de empresa aberto pelo menu, o Meu Perfil institucional e o fluxo de Solicitar Acesso usem o mesmo modelo de empresa, sem perder integração com Qase.

## Regra principal

Empresa não é só nome e CNPJ. O cadastro precisa manter:

- Dados cadastrais da empresa.
- Usuário institucional da empresa.
- Logo/avatar da empresa.
- Fan-out de notificações.
- Integração com Qase.
- Projetos Qase vinculados.
- Aplicações geradas a partir dos projetos Qase.
- Vínculo com solicitações de acesso.

## Regra de integração Qase completa

Qase não é apenas um vínculo de projeto. Quando a empresa integra Qase, ela deve poder escolher como quer sincronizar os artefatos de QA:

| Modo | Comportamento |
| --- | --- |
| `disabled` | Qase configurado parcialmente ou sem projeto/token. Nada é enviado. |
| `selected` | Envia apenas os escopos escolhidos pela empresa/admin. |
| `everything` | Envia tudo que o Quality Control suporta para o Qase. |

Quando o modo for `everything`, o sistema deve permitir sincronizar:

- Casos de teste.
- Planos de teste.
- Execuções / runs.
- Resultados de execução.
- Defeitos.
- Evidências.
- Anexos.
- Marcos / releases.
- Status de automação.

A empresa precisa enxergar essa escolha no modal. Não pode ficar implícito.

## Campos mínimos da empresa

| Campo | Origem | Observação |
| --- | --- | --- |
| `name` / `company_name` | Modal / Meu Perfil / Solicitar acesso | Nome da empresa ou razão social. |
| `tax_id` / `cnpj` | Modal / Solicitar acesso | Validar CNPJ quando preenchido. |
| `cep` | Modal / Solicitar acesso | Pode preencher endereço automaticamente. |
| `address` | Modal / Solicitar acesso | Endereço completo ou normalizado. |
| `phone` | Modal / Solicitar acesso | Telefone comercial. |
| `website` | Modal / Solicitar acesso | Site institucional. |
| `linkedin_url` | Modal / Solicitar acesso | LinkedIn da empresa. |
| `logo_url` | Modal / Meu Perfil | Pode ser upload, URL, emoji, imagem ou GIF. |
| `companyUsername` | Modal / Meu Perfil | Login institucional da empresa. |
| `notifications_fanout_enabled` | Modal / Meu Perfil | Define se alterações no contexto notificam vinculados. |

## Campos mínimos de Qase

| Campo | Origem | Observação |
| --- | --- | --- |
| `integration_mode` | Modal / Meu Perfil | `qase` quando houver token ou projeto; `manual` quando não houver. |
| `qase_token` | Modal / Meu Perfil | Token pode ser novo ou já salvo. |
| `qase_project_code` | Modal | Projeto principal. |
| `qase_project_codes` | Modal / Meu Perfil | Lista de projetos vinculados. |
| `qase_projects` | Modal | Lista detalhada para criar aplicações. |
| `qase_sync_mode` | Modal / Meu Perfil | `disabled`, `selected` ou `everything`. |
| `qase_sync_scopes` | Modal / Meu Perfil | Lista de escopos habilitados. |
| `send_everything_to_qase` | Modal / Meu Perfil | Atalho booleano para sincronização completa. |
| `integrations` | Modal | Payload futuro para multi-integração. |

## Payload esperado para Qase completo

```json
{
  "integrationMode": "qase",
  "qaseToken": "<token>",
  "qaseProjectCode": "SFQ",
  "qaseProjectCodes": ["SFQ", "CID"],
  "qaseSyncMode": "everything",
  "qaseSyncScopes": [
    "test_cases",
    "test_plans",
    "test_runs",
    "test_results",
    "defects",
    "evidence",
    "attachments",
    "milestones",
    "automation_status"
  ],
  "sendEverythingToQase": true,
  "integrations": [
    {
      "type": "QASE",
      "config": {
        "token": "<token>",
        "projects": ["SFQ", "CID"],
        "syncMode": "everything",
        "syncScopes": ["test_cases", "test_plans", "test_runs", "test_results", "defects", "evidence", "attachments", "milestones", "automation_status"],
        "sendEverything": true
      }
    }
  ]
}
```

## Comportamento esperado no modal do menu

1. Abrir modal de criar empresa.
2. Exibir blocos claros:
   - Identificação da empresa.
   - Responsável/usuário institucional.
   - Visual da empresa.
   - Integração Qase.
   - Aplicações que serão criadas.
   - Modo de sincronização Qase.
3. Se `syncWithMyProfile=true`, pré-preencher dados de `/api/me/company-profile`.
4. Preservar `qase_project_codes`, `qase_token`, `qase_sync_mode` e `qase_sync_scopes` vindos do Meu Perfil.
5. Ao salvar, enviar:
   - Dados cadastrais.
   - `companyUsername`.
   - `notificationsFanoutEnabled`.
   - `integrationMode`.
   - `qaseToken`.
   - `qaseProjectCode`.
   - `qaseProjectCodes`.
   - `qase_projects`.
   - `qaseSyncMode`.
   - `qaseSyncScopes`.
   - `sendEverythingToQase`.
   - `integrations`.
6. Após salvar, sincronizar de volta com Meu Perfil quando for fluxo institucional.

## Comportamento esperado em Solicitar Acesso

Quando o perfil solicitado for `empresa`, o formulário precisa capturar os mesmos dados básicos de criação de empresa:

- Nome da empresa.
- CNPJ.
- CEP.
- Endereço.
- Telefone.
- Website.
- LinkedIn.
- Descrição.
- Observações.

O fluxo de Solicitar Acesso não deve obrigar Qase no primeiro pedido, mas deve preservar espaço para o admin completar a integração depois no modal de empresa.

## Diferença entre os fluxos

| Fluxo | Pode criar empresa? | Pode configurar Qase? | Pode gerar aplicações? | Pode definir sync Qase? |
| --- | --- | --- | --- | --- |
| Modal do menu | Sim | Sim | Sim, a partir dos projetos Qase selecionados. | Sim. |
| Meu Perfil empresa | Atualiza empresa institucional | Sim | Não deve criar aplicações automaticamente sem ação explícita. | Sim. |
| Solicitar Acesso | Solicita criação de empresa | Não obrigatório | Não, fica para aprovação/admin. | Não no primeiro pedido. |

## Brian e notificações

Toda ação de empresa deve gerar evento com payload operacional:

```json
{
  "operationalArea": "access",
  "entityType": "access_request",
  "sourceAction": "created",
  "sourceId": "<requestId>",
  "companySlug": "<empresa>",
  "route": "/admin/access-requests"
}
```

Para empresa criada pelo modal:

```json
{
  "operationalArea": "access",
  "entityType": "company",
  "sourceAction": "created",
  "sourceId": "<companyId>",
  "companySlug": "<empresa>",
  "route": "/clients"
}
```

Para alteração de sync Qase:

```json
{
  "operationalArea": "integration",
  "entityType": "qase_sync_policy",
  "sourceAction": "updated",
  "sourceId": "<companyId>",
  "companySlug": "<empresa>",
  "qaseSyncMode": "everything",
  "sendEverythingToQase": true,
  "route": "/clients"
}
```

## Próximos ajustes de UI

- Melhorar cabeçalho do modal com resumo: empresa, responsável, Qase, aplicações.
- Separar visualmente dados cadastrais, Meu Perfil, Qase e aplicações.
- Exibir aviso quando Qase estiver configurado no Meu Perfil e sendo reutilizado no modal.
- Exibir contador de projetos Qase selecionados.
- Exibir lista das aplicações que serão criadas.
- Exibir seletor de modo Qase: `disabled`, `selected`, `everything`.
- Exibir opção explícita: Enviar tudo ao Qase.
- No Solicitar Acesso, reforçar que perfil `Empresa` vira solicitação de criação de empresa.
