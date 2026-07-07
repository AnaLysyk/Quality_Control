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
      title: "Modulos e Telas",
      description: "Resumo funcional das areas reais do produto.",
      icon: "FiGrid",
      order: 30,
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
  ];

  const endpointRows = operationRows(openApiDocument as OpenApiDocument);

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
          text: "Esta wiki existe para ser a _fonte unica de verdade_ do produto. Antes de alterar regras de acesso, usuarios, empresas, modulos ou APIs, consulte esta documentacao e atualize-a no mesmo PR.",
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
            ["`E2E_LEADER_EMAIL`", "Conta com perfil Lider TC completo para navegar nas telas."],
            ["`E2E_LEADER_PASSWORD`", "Senha da conta anterior."],
            ["`E2E_DOCUMENTATION_COMPANY_SLUG`", "Empresa alvo das capturas, padrao `testing-company`."]
          ],
        },
        {
          id: "qc-shots-list",
          type: "list",
          ordered: false,
          items: [
            "Saida esperada: `test-results/documentation-quality-control/`.",
            "Manifesto esperado: `screenshots-manifest.json` com status de cada rota visitada.",
            "Nomes padrao: `home-lider-tc.png`, `usuarios-listagem.png`, `chat.png`, `brain.png`, `suporte-kanban.png`, `agenda.png`, `documentacao.png`."
          ],
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
