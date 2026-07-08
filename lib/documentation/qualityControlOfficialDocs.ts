import type { PlatformDocsStore, WikiCategory, WikiDoc } from "@/data/platformDocsStore";
import openApiDocument from "../../docs/openapi/quality-control.openapi.json";
import type { OpenApiDocument } from "@/lib/documentation/apiDocsCoverage";

export const QUALITY_CONTROL_OFFICIAL_COMPANY_SLUG = "testing-company";
const QUALITY_CONTROL_COMPANY_ALIASES = new Set(["testing-company", "testing-company-e2e"]);
const DOC_TIMESTAMP = "2026-07-07T00:00:00.000Z";

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function operationRows(document: OpenApiDocument) {
  return Object.entries(document.paths ?? {})
    .flatMap(([routePath, methods]) =>
      Object.entries(methods ?? {})
        .filter(([method]) => ["get", "post", "put", "patch", "delete", "options", "head"].includes(method.toLowerCase()))
        .map(([method, operation]) => {
          const metadata = (operation ?? {}) as {
            summary?: string;
            tags?: string[];
            "x-authorizedRoles"?: string[];
          };
          return [
            method.toUpperCase(),
            `\`${routePath}\``,
            metadata.summary ?? "Sem resumo",
            (metadata.tags ?? []).join(", ") || "Sem tag",
            (metadata["x-authorizedRoles"] ?? []).join(", ") || "Autenticado",
          ];
        }),
    )
    .sort((a, b) => `${a[1]} ${a[0]}`.localeCompare(`${b[1]} ${b[0]}`));
}

function category(input: Pick<WikiCategory, "id" | "slug" | "title"> & Partial<WikiCategory>): WikiCategory {
  return {
    order: 0,
    createdAt: DOC_TIMESTAMP,
    updatedAt: DOC_TIMESTAMP,
    ...input,
  };
}

function doc(input: Pick<WikiDoc, "id" | "categoryId" | "slug" | "title" | "blocks"> & Partial<WikiDoc>): WikiDoc {
  return {
    status: "published",
    order: 0,
    createdAt: DOC_TIMESTAMP,
    updatedAt: DOC_TIMESTAMP,
    ...input,
  };
}

export function mergePlatformDocsStore(primary: PlatformDocsStore, fallback: PlatformDocsStore): PlatformDocsStore {
  const categoryBySlug = new Map<string, WikiCategory>();
  const docBySlug = new Map<string, WikiDoc>();

  for (const item of fallback.categories) {
    categoryBySlug.set(item.slug, item);
  }
  for (const item of primary.categories) {
    categoryBySlug.set(item.slug, item);
  }

  for (const item of fallback.docs) {
    docBySlug.set(item.slug, item);
  }
  for (const item of primary.docs) {
    docBySlug.set(item.slug, item);
  }

  return {
    categories: Array.from(categoryBySlug.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    docs: Array.from(docBySlug.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  };
}

export function buildQualityControlOfficialDocsStore(): PlatformDocsStore {
  const categories: WikiCategory[] = [
    category({
      id: "qc-cat-manual-operacional",
      slug: "manual-operacional",
      title: "Manual Operacional",
      description: "Fonte oficial das telas, fluxos e regras praticas do produto.",
      icon: "FiBookOpen",
      order: 10,
    }),
    category({
      id: "qc-cat-acesso-governanca",
      slug: "acesso-governanca",
      title: "Acesso e Governanca",
      description: "Perfis, empresa ativa, rotas protegidas e comportamentos esperados.",
      icon: "FiSettings",
      order: 20,
    }),
    category({
      id: "qc-cat-modulos-telas",
      slug: "modulos-telas",
      title: "UI, Usuarios e Telas",
      description: "Manual visual, elementos de interface e areas reais do produto.",
      icon: "FiGrid",
      order: 30,
    }),
    category({
      id: "qc-cat-agentes-dados",
      slug: "agentes-dados",
      title: "Agentes e Dados",
      description: "Como assistentes consultam, inserem e auditam informacoes documentais.",
      icon: "FiLayers",
      order: 35,
    }),
    category({
      id: "qc-cat-api-openapi",
      slug: "api-openapi",
      title: "API e OpenAPI",
      description: "Endpoints criticos, contratos e cobertura documental.",
      icon: "FiCode",
      order: 40,
    }),
    category({
      id: "qc-cat-operacao-docs",
      slug: "operacao-documentacao",
      title: "Operacao da Documentacao",
      description: "Fluxo de manutencao, capturas de tela e checklist de atualizacao.",
      icon: "FiDatabase",
      order: 50,
    }),
    category({
      id: "qc-cat-banco-estrutura",
      slug: "banco-estrutura",
      title: "Banco e Estrutura",
      description: "Modelos, tabelas, repositorios e relacao entre empresa, projeto e wiki.",
      icon: "FiDatabase",
      order: 60,
    }),
    category({
      id: "qc-cat-ferramentas",
      slug: "ferramentas-construcao",
      title: "Ferramentas de Construcao",
      description: "Stack, scripts e ferramentas usadas para desenvolver, testar e publicar.",
      icon: "FiSettings",
      order: 70,
    }),
  ];

  const endpointRows = operationRows(openApiDocument as OpenApiDocument);
  const screenshotRows = [
    ["Documentacao oficial", "`/empresas/testing-company/docs`", "`documentacao.png`", "Sidebar de categorias, status do doc, blocos de conteudo, botao editar para perfis autorizados."],
    ["Repositorio de documentos", "`/empresas/testing-company/documentos`", "`documentos.png`", "Arquivos, links, wiki da empresa, filtros e area para anexos/evidencias."],
    ["Gestao de usuarios", "`/admin/users`", "`usuarios-listagem.png`", "Tabela de usuarios, filtros, modal de criacao/edicao e escopo de empresa."],
    ["Chat operacional", "`/chat`", "`chat.png`", "Lista de contatos, compositor, anexos, agenda e mensagens por contexto permitido."],
    ["Suporte / Kanban", "`/kanban-it`", "`suporte-kanban.png`", "Colunas de atendimento, cards, responsavel, comentarios e eventos."],
    ["Brain", "`/brain`", "`brain.png`", "Grafo, chat, agentes, memoria, busca e acoes governadas."],
    ["Agenda", "`/agenda`", "`agenda.png`", "Calendario, agendamentos, reunioes e escopo por empresa/projeto."],
  ];

  const docs: WikiDoc[] = [
    doc({
      id: "qc-doc-manual-oficial",
      categoryId: "qc-cat-manual-operacional",
      slug: "manual-do-sistema-quality-control",
      title: "Manual do Sistema Quality Control",
      description: "Pagina inicial da documentacao oficial do produto.",
      order: 10,
      blocks: [
        { id: "qc-manual-h1", type: "heading", level: 1, text: "Documentacao Oficial Quality Control" },
        {
          id: "qc-manual-p1",
          type: "paragraph",
          text: "Esta wiki existe para ser a _fonte unica de verdade_ do produto dentro de `Testing Company > Quality Control`. Antes de alterar regras de acesso, usuarios, empresas, modulos ou APIs, consulte esta documentacao e atualize-a no mesmo PR.",
        },
        {
          id: "qc-manual-card",
          type: "card",
          variant: "warning",
          title: "Regra central",
          text: "Esconder menu, botao ou rota visual _nao_ substitui a protecao de API. Sempre documente tambem qual endpoint devolve `403` quando o perfil nao possui permissao.",
        },
        {
          id: "qc-manual-table",
          type: "table",
          headers: ["Area", "Objetivo", "Referencia principal"],
          rows: [
            ["Manual funcional", "Explicar o que cada tela faz e quando deve ser usada.", "`/empresas/testing-company/docs`"],
            ["Projeto oficial", "Centralizar documentacao, testes e evidencias do proprio produto.", "`Testing Company > Quality Control`"],
            ["Matriz de acesso", "Mostrar quem acessa cada modulo por perfil e por empresa ativa.", "Doc de governanca e perfis"],
            ["OpenAPI", "Registrar contratos minimos dos endpoints criticos.", "`docs/openapi/quality-control.openapi.json`"],
            ["Screenshots", "Fornecer evidencia visual do produto real ou do ambiente configurado.", "`npm run docs:capture-screens`"],
            ["Checklist de PR", "Evitar mudanca sem documentacao correspondente.", "`npm run docs:check-api`"]
          ],
          caption: "Resumo do que esta documentacao precisa cobrir continuamente."
        },
        {
          id: "qc-manual-list",
          type: "list",
          ordered: true,
          items: [
            "Quando uma _regra de permissao_ mudar, atualize manual, matriz de acesso e OpenAPI.",
            "Quando um _endpoint novo_ nascer em `app/api/**/route.ts`, documente-o no mesmo PR.",
            "Quando uma _tela nova_ for entregue, adicione objetivo, rota, APIs consumidas e comportamento de bloqueio.",
            "Quando a captura real de tela nao puder rodar no ambiente, registre a pendencia em vez de inventar evidencia."
          ],
        },
      ],
    }),
    doc({
      id: "qc-doc-matriz-acesso",
      categoryId: "qc-cat-acesso-governanca",
      slug: "matriz-de-acesso-por-perfil",
      title: "Matriz de Acesso por Perfil",
      description: "Resumo pratico do escopo esperado de cada perfil.",
      order: 20,
      blocks: [
        { id: "qc-matriz-h1", type: "heading", level: 1, text: "Matriz de acesso por perfil" },
        {
          id: "qc-matriz-p1",
          type: "paragraph",
          text: "A matriz abaixo reflete a logica atual de contexto operacional: empresa ativa, escopo por empresa/projeto, permissao por perfil e override por usuario.",
        },
        {
          id: "qc-matriz-table",
          type: "table",
          headers: ["Perfil", "Escopo padrao", "Criacao de usuario", "Gestao de Perfil global", "Observacao obrigatoria"],
          rows: [
            ["Lider TC", "Global, com troca de empresa conforme permissao.", "Pode criar perfis internos e empresariais.", "Pode acessar.", "Responsavel por governanca ampla e revisao de regras."],
            ["Suporte Tecnico", "Global ou contextual, conforme permissao liberada.", "Somente o que a permissao permitir.", "Depende de permissao.", "Nao deve ganhar acesso por acidente a modulos fora da propria liberacao."],
            ["Usuario TC", "Contextual a empresa/projeto em que foi vinculado.", "Nao cria usuarios por padrao.", "Nao acessa.", "Nao deve ver empresas nem dados fora do contexto recebido."],
            ["Empresa", "Apenas propria empresa ativa.", "Pode criar apenas `company_user`.", "Nao acessa.", "Nao pode criar `leader_tc`, `technical_support` nem `testing_company_user`, inclusive por API."],
            ["Usuario Empresarial", "Apenas propria empresa ativa.", "Nao cria usuarios por padrao.", "Nao acessa.", "Nao troca empresa e nao ve dados de outra empresa por rota direta ou API."]
          ],
          caption: "Use esta matriz antes de alterar menu, front ou endpoints protegidos."
        },
        {
          id: "qc-matriz-card",
          type: "card",
          variant: "danger",
          title: "Erro comum a evitar",
          text: "Nao reutilize permissao global para mudar comportamento de um usuario em apenas uma empresa. Override por usuario precisa respeitar o contexto da empresa ativa e nao pode vazar para outros vinculos.",
        },
      ],
    }),
    doc({
      id: "qc-doc-fluxos-criticos",
      categoryId: "qc-cat-acesso-governanca",
      slug: "fluxos-criticos-de-acesso",
      title: "Fluxos Criticos de Acesso",
      description: "Entrada principal no sistema, aprovacao e bloqueio.",
      order: 30,
      blocks: [
        { id: "qc-fluxos-h1", type: "heading", level: 1, text: "Fluxos criticos de acesso" },
        {
          id: "qc-fluxos-p1",
          type: "paragraph",
          text: "Esses fluxos merecem regressao sempre que houver mudanca em usuarios, empresas, solicitacoes de acesso ou permissao por modulo.",
        },
        {
          id: "qc-fluxos-list",
          type: "list",
          ordered: true,
          items: [
            "Criacao de empresa: Lider TC cria, empresa nova aparece apenas para quem pode enxergar o contexto.",
            "Solicitacao de acesso: o pedido nasce _pendente_ e vinculado corretamente a empresa escolhida.",
            "Aprovacao: ao aceitar, a API precisa respeitar o perfil solicitado e o aprovador; empresa aprova apenas usuario empresarial da propria empresa.",
            "Bloqueio por modulo: quando uma permissao e removida, o menu some, a rota nao exibe dados sensiveis e a API correspondente devolve `403`."
          ],
        },
        {
          id: "qc-fluxos-table",
          type: "table",
          headers: ["Fluxo", "Entrada", "Saida esperada", "APIs criticas"],
          rows: [
            ["Criacao manual de usuario", "Tela de Gestao de Usuarios", "Usuario criado com vinculo correto e sem vazar para outra empresa.", "`GET/POST /api/admin/users`"],
            ["Solicitar acesso", "Formulario publico autenticado/assistido", "Solicitacao pendente e rastreavel.", "`GET/POST /api/access-requests`"],
            ["Aprovar solicitacao", "Fila de revisao", "Usuario criado apenas quando o perfil e o escopo forem permitidos.", "`POST /api/admin/access-requests/{id}/accept`"],
            ["Bloqueio de Chat", "Permissao removida por perfil/usuario", "Menu some e endpoints do chat respondem `403`.", "`GET /api/chat/contacts`, `POST /api/chat/messages`"]
          ],
        },
      ],
    }),
    doc({
      id: "qc-doc-modulos-telas",
      categoryId: "qc-cat-modulos-telas",
      slug: "modulos-e-telas-do-produto",
      title: "Modulos e Telas do Produto",
      description: "Mapa funcional das areas mais criticas.",
      order: 40,
      blocks: [
        { id: "qc-modulos-h1", type: "heading", level: 1, text: "Modulos e telas reais do produto" },
        {
          id: "qc-modulos-table",
          type: "table",
          headers: ["Area", "Rotas de referencia", "Perfis mais comuns", "APIs que precisam proteger a regra"],
          rows: [
            ["Gestao de Usuarios", "`/admin/users`", "Lider TC, Suporte Tecnico conforme permissao, Empresa na propria empresa.", "`/api/admin/users`, `/api/admin/user-permissions/{userId}`"],
            ["Permissoes por Usuario", "`/admin/users/permissions`", "Lider TC e perfis liberados.", "`/api/admin/user-permissions/{userId}`"],
            ["Solicitacoes de Acesso", "`/admin/access-requests`", "Lider TC, Suporte Tecnico e Empresa no proprio contexto.", "`/api/access-requests`, `/api/admin/access-requests/{id}/accept`"],
            ["Projetos", "`/empresas/[slug]/projetos`", "Lider TC, Suporte Tecnico, Empresa conforme escopo.", "`/api/projects`"],
            ["Aplicacoes", "`/empresas/[slug]/aplicacoes`", "Mesma regra do contexto operacional da empresa.", "`/api/applications`"],
            ["Chat", "`/chat`", "Perfis com modulo liberado.", "`/api/chat/contacts`, `/api/chat/messages`"],
            ["Suporte / Kanban", "`/kanban-it`", "Perfis com modulo de chamados.", "`/api/tickets`"],
            ["Documentacao", "`/documentos`, `/empresas/[slug]/docs`", "Lider TC, Suporte Tecnico e empresa dentro do proprio contexto.", "`/api/platform-docs`, `/api/company-docs/{companySlug}`"],
            ["Agenda", "`/agenda`", "Somente dentro da empresa/projeto liberado.", "Documentar endpoints reais da agenda quando forem evoluidos no OpenAPI."],
            ["Brain", "`/brain`", "Somente dados e nos do contexto liberado.", "Documentar endpoints reais do Brain quando forem evoluidos no OpenAPI."]
          ],
          caption: "Lista inicial. Amplie com novas telas assim que o modulo crescer."
        },
        {
          id: "qc-modulos-card",
          type: "card",
          variant: "tip",
          title: "Como usar esta pagina",
          text: "Quando voce tocar numa tela, atualize tambem o objetivo da area, as APIs consumidas e o comportamento esperado quando a permissao e removida.",
        },
      ],
    }),
    doc({
      id: "qc-doc-ui-prints-elementos",
      categoryId: "qc-cat-modulos-telas",
      slug: "manual-ui-com-prints-e-elementos",
      title: "Manual UI com Prints e Elementos",
      description: "Referencia visual para usuarios e agentes documentarem as telas principais.",
      order: 45,
      blocks: [
        { id: "qc-ui-h1", type: "heading", level: 1, text: "Manual UI com prints e elementos" },
        {
          id: "qc-ui-p1",
          type: "paragraph",
          text: "Cada tela documentada precisa ter objetivo, rota, perfis que acessam, APIs consumidas, elementos visiveis e screenshot real capturado pelo fluxo `npm run docs:capture-screens`.",
        },
        {
          id: "qc-ui-img-docs",
          type: "image",
          src: "/docs/quality-control/screenshots/documentacao.png",
          alt: "Print da wiki oficial do Quality Control dentro da Testing Company",
          caption: "Tela de documentacao oficial. Se o print ainda nao existir, rode `npm run docs:capture-screens` com ambiente e credenciais E2E configurados.",
          href: "/empresas/testing-company/docs",
        },
        {
          id: "qc-ui-table",
          type: "table",
          headers: ["Tela", "Rota", "Print esperado", "Elementos que devem ser documentados"],
          rows: screenshotRows,
          caption: "Inventario inicial das telas que precisam de evidencia visual e descricao de elementos."
        },
        {
          id: "qc-ui-list",
          type: "list",
          ordered: true,
          items: [
            "Para usuario final, descreva o que a pessoa consegue fazer e quais campos/botoes aparecem.",
            "Para QA, registre estados vazios, carregamento, erro, permissao negada e sucesso.",
            "Para agentes, registre quais APIs podem ser consultadas e quais insercoes exigem permissao ou revisao.",
            "Para produto, mantenha o print sincronizado com a tela real sempre que layout ou fluxo mudar."
          ],
        },
        {
          id: "qc-ui-card",
          type: "card",
          variant: "warning",
          title: "Print nao substitui regra",
          text: "O print prova como a tela estava no momento da captura. A regra oficial continua sendo a combinacao entre documentacao, API protegida, banco e teste automatizado.",
        },
      ],
    }),
    doc({
      id: "qc-doc-repositorio-testes",
      categoryId: "qc-cat-modulos-telas",
      slug: "documentacao-e-repositorio-de-testes",
      title: "Documentacao e Repositorio de Testes",
      description: "Como a propria documentacao deve viver dentro do produto.",
      order: 50,
      blocks: [
        { id: "qc-repo-h1", type: "heading", level: 1, text: "Documentacao e repositorio de testes" },
        {
          id: "qc-repo-p1",
          type: "paragraph",
          text: "O Quality Control ja possui area de documentos e wiki por empresa. Esta implementacao reaproveita essa estrutura para hospedar a documentacao oficial dentro do contexto da `Testing Company`, sem criar outro repositorio paralelo.",
        },
        {
          id: "qc-repo-table",
          type: "table",
          headers: ["Recurso", "Uso", "Observacao"],
          rows: [
            ["`/documentos`", "Resumo da area documental do usuario logado.", "Para perfis globais pode apontar para wiki da plataforma ou wiki por empresa."],
            ["`/empresas/testing-company/documentos`", "Repositorio de arquivos e links da Testing Company.", "Usar para evidencias anexas e materiais externos."],
            ["`/empresas/testing-company/docs`", "Wiki navegavel com manual, matriz, OpenAPI e governanca.", "Esta e a entrada principal da documentacao oficial."],
            ["Banco `wiki_categories` / `wiki_docs`", "Persistencia da wiki.", "Fonte runtime; o conteudo oficial versionado serve como bootstrap e referencia de codigo."]
          ],
        },
      ],
    }),
    doc({
      id: "qc-doc-agentes-documentacao",
      categoryId: "qc-cat-agentes-dados",
      slug: "agentes-consulta-insercao-documentacao",
      title: "Agentes: Consulta e Insercao na Documentacao",
      description: "Como os agentes usam a wiki, Brain e APIs para manter a documentacao viva.",
      order: 55,
      blocks: [
        { id: "qc-agentes-h1", type: "heading", level: 1, text: "Agentes, consultas e insercao documental" },
        {
          id: "qc-agentes-p1",
          type: "paragraph",
          text: "Os agentes devem consultar primeiro a wiki da `Testing Company > Quality Control`, depois OpenAPI, banco e Brain. Quando precisarem inserir dados, devem usar endpoints autenticados, respeitar perfil/empresa/projeto e deixar rastro em auditoria ou historico da propria entidade.",
        },
        {
          id: "qc-agentes-table",
          type: "table",
          headers: ["Agente / area", "Pode consultar", "Pode inserir ou atualizar", "Guardrail"],
          rows: [
            ["Assistente de tela", "Contexto da rota, permissao do usuario, docs publicadas e dados do modulo atual.", "Comentarios, tickets, casos de teste ou docs apenas via ferramenta permitida.", "Nunca deve usar dado fora do escopo da empresa/projeto ativo."],
            ["Brain operacional", "`BrainNode`, `BrainMemory`, eventos, wiki e entidades sincronizadas.", "Memorias, sugestoes e relacoes quando houver origem rastreavel.", "Memoria sensivel precisa de classificacao e revisao quando afetar cliente ou permissao."],
            ["QA Agent", "Casos, planos, runs, defeitos, prints e OpenAPI.", "Rascunhos de caso, automacao, evidencias e sugestoes de cobertura.", "Nao publicar automaticamente evidencia falsa; se nao capturou, registrar pendencia."],
            ["Playwright Agent", "Rotas, seletores, casos de teste, assets autorizados e credenciais E2E do ambiente.", "Resultados, screenshots e traces em pasta de evidencia.", "Nao salvar senha, token, cookie nem payload sensivel no repositorio."],
            ["Memory Agent", "Historico operacional, decisoes e regras versionadas.", "Memorias tecnicas com status `ACTIVE` ou sugestoes pendentes.", "Toda memoria precisa ter fonte, escopo e criterio de expiracao quando aplicavel."]
          ],
          caption: "Matriz minima para agentes que consultam ou alimentam documentacao."
        },
        {
          id: "qc-agentes-code",
          type: "code",
          language: "text",
          code: "Consulta: GET /api/company-docs/testing-company\nCriacao de doc: POST /api/company-docs/testing-company/docs\nAtualizacao de doc: PATCH /api/company-docs/testing-company/docs/{id}\nBusca Brain: POST /api/brain/search ou POST /api/brain/query/hybrid\nAuditoria assistente: assistant_audit_logs",
          caption: "Pontos de integracao usados por agentes e automacoes documentais."
        },
        {
          id: "qc-agentes-list",
          type: "list",
          ordered: true,
          items: [
            "Consultar docs publicadas antes de responder ou alterar fluxo.",
            "Quando uma lacuna for encontrada, criar rascunho ou sugestao com fonte e contexto.",
            "Quando a lacuna for confirmada, publicar doc ou atualizar bloco com `createdBy`/`updatedBy` real.",
            "Ao inserir evidencia, anexar print, rota, data, ambiente e usuario/perfil usado.",
            "Ao tocar em API ou permissao, atualizar OpenAPI e checklist da wiki no mesmo ciclo."
          ],
        },
      ],
    }),
    doc({
      id: "qc-doc-openapi",
      categoryId: "qc-cat-api-openapi",
      slug: "swagger-openapi-inicial",
      title: "Swagger / OpenAPI Inicial",
      description: "Contrato versionado dos endpoints criticos do produto.",
      order: 60,
      blocks: [
        { id: "qc-openapi-h1", type: "heading", level: 1, text: "Swagger / OpenAPI inicial" },
        {
          id: "qc-openapi-p1",
          type: "paragraph",
          text: "A especificacao base fica em `docs/openapi/quality-control.openapi.json`. Ela cobre primeiro os endpoints criticos de acesso, usuarios, projetos, aplicacoes, chamados, chat e documentacao.",
        },
        {
          id: "qc-openapi-code",
          type: "code",
          language: "bash",
          code: "npm run docs:check-api\nnpm run docs:sync-quality-control",
          caption: "Comandos principais para validar cobertura e materializar a documentacao na wiki da Testing Company.",
        },
        {
          id: "qc-openapi-table",
          type: "table",
          headers: ["Metodo", "Path", "Resumo", "Tag", "Perfis / contexto"],
          rows: endpointRows,
          caption: "Operacoes presentes na especificacao OpenAPI inicial versionada neste repositorio."
        },
      ],
    }),
    doc({
      id: "qc-doc-api-ui-contratos",
      categoryId: "qc-cat-api-openapi",
      slug: "contratos-api-ui-por-tela",
      title: "Contratos API x UI por Tela",
      description: "Como cada tela se apoia nos endpoints e no comportamento de permissao.",
      order: 65,
      blocks: [
        { id: "qc-api-ui-h1", type: "heading", level: 1, text: "Contratos API x UI por tela" },
        {
          id: "qc-api-ui-p1",
          type: "paragraph",
          text: "Toda documentacao de tela deve apontar quais endpoints alimentam a UI e qual resposta esperada ocorre sem autenticacao, sem permissao ou fora do escopo da empresa/projeto.",
        },
        {
          id: "qc-api-ui-table",
          type: "table",
          headers: ["UI", "Leitura principal", "Escrita principal", "Falha obrigatoria"],
          rows: [
            ["Usuarios", "`GET /api/admin/users`", "`POST/PATCH /api/admin/users`", "`401` sem sessao, `403` sem permissao ou fora do escopo."],
            ["Solicitacoes de acesso", "`GET /api/access-requests`", "`POST /api/admin/access-requests/{id}/accept`", "`403` quando empresa tenta aprovar perfil que nao pode criar."],
            ["Documentacao", "`GET /api/company-docs/{companySlug}`", "`POST/PATCH /api/company-docs/{companySlug}/docs`", "`403` para leitura fora da empresa ou edicao sem perfil autorizado."],
            ["Projetos", "`GET /api/projects`", "`POST /api/projects`", "`403` quando a empresa/projeto ativo nao pertence ao usuario."],
            ["Aplicacoes", "`GET /api/applications`", "`POST/PATCH /api/applications`", "`403` para escopo indevido; fallback visual sem quebrar shell."],
            ["Chat", "`GET /api/chat/contacts`", "`POST /api/chat/messages`", "`403` quando modulo de chat esta bloqueado."],
            ["Tickets/Kanban", "`GET /api/tickets`", "`POST/PATCH /api/tickets/{id}`", "`403` quando modulo de suporte nao esta liberado."]
          ],
          caption: "A tabela deve crescer junto com a especificacao OpenAPI."
        },
        {
          id: "qc-api-ui-card",
          type: "card",
          variant: "danger",
          title: "Contrato minimo de seguranca",
          text: "Se uma tela esconde uma acao, a API correspondente tambem precisa negar a acao. Teste de UI sem teste de API deixa a regra incompleta.",
        },
      ],
    }),
    doc({
      id: "qc-doc-banco-estrutura-sistema",
      categoryId: "qc-cat-banco-estrutura",
      slug: "banco-de-dados-e-estrutura-do-sistema",
      title: "Banco de Dados e Estrutura do Sistema",
      description: "Mapa das entidades centrais do Quality Control e relacao com a documentacao.",
      order: 90,
      blocks: [
        { id: "qc-banco-h1", type: "heading", level: 1, text: "Banco de dados e estrutura do sistema" },
        {
          id: "qc-banco-p1",
          type: "paragraph",
          text: "O sistema usa Next.js com Prisma/PostgreSQL. A documentacao oficial da Testing Company fica nas tabelas `wiki_categories` e `wiki_docs`, vinculada por `companySlug = testing-company`; o projeto `Quality Control` fica em `projects.slug = quality-control` dentro da empresa.",
        },
        {
          id: "qc-banco-table",
          type: "table",
          headers: ["Modelo / tabela", "Papel", "Campos de escopo importantes", "Uso documental"],
          rows: [
            ["`Company` / `companies`", "Empresa ou cliente operacional.", "`slug`, `qase_project_codes`, `integration_mode`", "Define `testing-company` como contexto oficial da documentacao."],
            ["`Project` / `projects`", "Projeto dentro da empresa.", "`companyId`, `slug`, `status`", "Garante o projeto `quality-control` como guarda-chuva de docs/testes."],
            ["`WikiCategory` / `wiki_categories`", "Categorias da wiki.", "`companySlug`, `slug`, `order`", "Organiza manual, UI, API, agentes, banco e ferramentas."],
            ["`WikiDoc` / `wiki_docs`", "Documentos renderizados na plataforma.", "`companySlug`, `categoryId`, `status`, `blocks`", "Guarda blocos de texto, tabela, codigo, card e imagem."],
            ["`BrainNode` / `brain_nodes`", "Nos do grafo de conhecimento.", "`refType`, `refId`, `privacyLevel`", "Permite aos agentes relacionarem telas, APIs, regras e documentos."],
            ["`BrainMemory` / `brain_memories`", "Memorias operacionais.", "`memoryType`, `status`, `sourceType`", "Registra decisoes e contexto reutilizavel por agentes."],
            ["`AssistantAuditLog` / `assistant_audit_logs`", "Auditoria de assistentes.", "`actorUserId`, `route`, `module`, `toolName`", "Rastreia consulta/acao automatizada feita por agentes."],
            ["`StoredTestCase` / `stored_test_cases`", "Repositorio de casos.", "`companyId`, `projectId`, `data`", "Liga cenario, evidencia e cobertura a empresa/projeto."],
            ["`AutomationDocument` / `automation_documents`", "Documentos usados em automacao.", "`companySlug`, `projectId`, `documentType`", "Guarda anexos e materiais consultaveis por testes/agentes."],
            ["`TestDataAsset` / `test_data_assets`", "Assets de teste.", "`companySlug`, `projectId`, `sensitivity`", "Controla evidencias, payloads e arquivos usados por automacoes."]
          ],
        },
        {
          id: "qc-banco-code",
          type: "code",
          language: "text",
          code: "Company(testing-company)\n  -> Project(quality-control)\n  -> WikiCategory/WikiDoc(companySlug=testing-company)\n  -> BrainNode/BrainMemory(refType=Document|Route|Screen)\n  -> StoredTestCase, TestRun, AutomationDocument, TestDataAsset",
          caption: "Relacao conceitual entre empresa, projeto, documentacao, agentes e evidencias."
        },
      ],
    }),
    doc({
      id: "qc-doc-ferramentas-construcao",
      categoryId: "qc-cat-ferramentas",
      slug: "ferramentas-usadas-na-construcao",
      title: "Ferramentas Usadas na Construcao",
      description: "Stack, scripts e pontos de verificacao do produto.",
      order: 100,
      blocks: [
        { id: "qc-tools-h1", type: "heading", level: 1, text: "Ferramentas usadas na construcao" },
        {
          id: "qc-tools-table",
          type: "table",
          headers: ["Camada", "Ferramentas", "Uso no Quality Control"],
          rows: [
            ["Frontend", "Next.js 16, React 19, Tailwind/CSS modules, Radix UI, React Icons, Recharts, Framer Motion", "Shell autenticado, dashboards, wiki, formularios, graficos e interacoes."],
            ["Backend/API", "Next.js route handlers, TypeScript, Prisma Client, PostgreSQL, Upstash Redis opcional", "APIs internas, RBAC, persistencia, cache e integracoes."],
            ["IA e agentes", "OpenAI SDK/AI SDK, Brain interno, agentes QA/Playwright/Memory/Debug", "Assistencia operacional, busca contextual, geracao de testes e documentacao assistida."],
            ["Qualidade", "Jest, Playwright, Axe, ESLint, TypeScript", "Testes unitarios/API/UI/acessibilidade, typecheck e lint."],
            ["Documentacao", "OpenAPI JSON, Postman/Newman, wiki `platform-docs`, scripts `support/functions/documentacao`", "Contratos, colecoes, sync da wiki e capturas de tela."],
            ["Deploy/ops", "Dockerfile, Render Blueprint, scripts de ambiente", "Build, start, migracoes e verificacoes de ambiente."]
          ],
        },
        {
          id: "qc-tools-code",
          type: "code",
          language: "bash",
          code: "npm run typecheck\nnpm test -- --runInBand testes/api/documentacao/quality-control-docs.test.ts\nnpm run docs:check-api\nnpm run docs:sync-quality-control\nnpm run docs:capture-screens",
          caption: "Comandos de verificacao e sincronizacao da documentacao oficial."
        },
        {
          id: "qc-tools-card",
          type: "card",
          variant: "tip",
          title: "Regra de manutencao",
          text: "Quando uma ferramenta nova entrar no fluxo de build, teste, agente ou documentacao, atualize esta pagina e o README tecnico correspondente.",
        },
      ],
    }),
    doc({
      id: "qc-doc-screenshots",
      categoryId: "qc-cat-operacao-docs",
      slug: "captura-de-telas-evidencias",
      title: "Captura de Telas e Evidencias",
      description: "Fluxo seguro para screenshots do sistema real.",
      order: 70,
      blocks: [
        { id: "qc-shots-h1", type: "heading", level: 1, text: "Captura de telas e evidencias" },
        {
          id: "qc-shots-p1",
          type: "paragraph",
          text: "As capturas devem usar credenciais configuradas por ambiente. _Nao_ grave senha, token ou cookie no repositorio. Quando o ambiente nao estiver pronto, o teste deve parar com mensagem clara e sem fabricar evidencia.",
        },
        {
          id: "qc-shots-table",
          type: "table",
          headers: ["Variavel", "Uso"],
          rows: [
            ["`E2E_BASE_URL` ou `PLAYWRIGHT_BASE_URL`", "Base URL do ambiente a ser documentado."],
            ["`E2E_LEADER_EMAIL`", "Conta com perfil Lider TC completo; em E2E local, padrao `e2e-leader-tc@testingcompany.local`."],
            ["`E2E_LEADER_PASSWORD` ou `E2E_PROFILE_PASSWORD`", "Senha da conta anterior; no E2E local, a massa usa `E2E_PROFILE_PASSWORD`."],
            ["`E2E_DOCUMENTATION_COMPANY_SLUG`", "Empresa alvo das capturas, padrao `testing-company`."]
          ],
        },
        {
          id: "qc-shots-list",
          type: "list",
          ordered: false,
          items: [
            "Saida esperada: `test-results/documentation-quality-control/`.",
            "Copia publica para a wiki: `public/docs/quality-control/screenshots/`.",
            "Manifesto esperado: `screenshots-manifest.json` com status de cada rota visitada.",
            "Nomes padrao: `home-lider-tc.png`, `usuarios-listagem.png`, `chat.png`, `brain.png`, `suporte-kanban.png`, `agenda.png`, `documentacao.png`."
          ],
        },
        {
          id: "qc-shots-img",
          type: "image",
          src: "/docs/quality-control/screenshots/documentacao.png",
          alt: "Screenshot da pagina de documentacao oficial da Testing Company",
          caption: "Imagem publicada pela automacao de captura. O bloco mostra pendencia quando o arquivo ainda nao existe.",
          href: "/empresas/testing-company/docs",
        },
        {
          id: "qc-shots-routes-table",
          type: "table",
          headers: ["Tela", "Rota", "Arquivo", "Elementos conferidos"],
          rows: screenshotRows,
        },
      ],
    }),
    doc({
      id: "qc-doc-checklist-atualizacao",
      categoryId: "qc-cat-operacao-docs",
      slug: "checklist-de-atualizacao-da-documentacao",
      title: "Checklist de Atualizacao da Documentacao",
      description: "Guardrails para PRs futuros.",
      order: 80,
      blocks: [
        { id: "qc-check-h1", type: "heading", level: 1, text: "Checklist de atualizacao" },
        {
          id: "qc-check-card",
          type: "card",
          variant: "success",
          title: "Definicao de pronto documental",
          text: "Uma mudanca de acesso, modulo ou endpoint so fica realmente pronta quando a regra operacional, o OpenAPI e a wiki correspondente forem atualizados juntos.",
        },
        {
          id: "qc-check-list",
          type: "list",
          ordered: true,
          items: [
            "Atualizar `docs/openapi/quality-control.openapi.json` quando surgir endpoint novo ou mudar contrato.",
            "Rodar `npm run docs:check-api` e registrar endpoints faltantes.",
            "Sincronizar a wiki oficial com `npm run docs:sync-quality-control` quando quiser materializar o conteudo no banco/wiki.",
            "Executar `npm run docs:capture-screens` quando houver ambiente com credenciais reais configuradas.",
            "Revisar se nenhuma regra nova depende apenas de esconder o front."
          ],
        },
      ],
    }),
  ];

  return { categories, docs };
}

export function getOfficialCompanyDocsForSlug(companySlug: string): PlatformDocsStore | null {
  if (!QUALITY_CONTROL_COMPANY_ALIASES.has(normalizeSlug(companySlug))) {
    return null;
  }
  return buildQualityControlOfficialDocsStore();
}
