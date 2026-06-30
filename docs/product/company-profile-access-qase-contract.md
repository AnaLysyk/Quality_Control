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
| `integrations` | Modal | Payload futuro para multi-integração. |

## Comportamento esperado no modal do menu

1. Abrir modal de criar empresa.
2. Exibir blocos claros:
   - Identificação da empresa.
   - Responsável/usuário institucional.
   - Visual da empresa.
   - Integração Qase.
   - Aplicações que serão criadas.
3. Se `syncWithMyProfile=true`, pré-preencher dados de `/api/me/company-profile`.
4. Preservar `qase_project_codes` e `qase_token` vindos do Meu Perfil.
5. Ao salvar, enviar:
   - Dados cadastrais.
   - `companyUsername`.
   - `notificationsFanoutEnabled`.
   - `integrationMode`.
   - `qaseToken`.
   - `qaseProjectCode`.
   - `qaseProjectCodes`.
   - `qase_projects`.
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

| Fluxo | Pode criar empresa? | Pode configurar Qase? | Pode gerar aplicações? |
| --- | --- | --- | --- |
| Modal do menu | Sim | Sim | Sim, a partir dos projetos Qase selecionados. |
| Meu Perfil empresa | Atualiza empresa institucional | Sim | Não deve criar aplicações automaticamente sem ação explícita. |
| Solicitar Acesso | Solicita criação de empresa | Não obrigatório | Não, fica para aprovação/admin. |

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

## Próximos ajustes de UI

- Melhorar cabeçalho do modal com resumo: empresa, responsável, Qase, aplicações.
- Separar visualmente dados cadastrais, Meu Perfil, Qase e aplicações.
- Exibir aviso quando Qase estiver configurado no Meu Perfil e sendo reutilizado no modal.
- Exibir contador de projetos Qase selecionados.
- Exibir lista das aplicações que serão criadas.
- No Solicitar Acesso, reforçar que perfil `Empresa` vira solicitação de criação de empresa.
