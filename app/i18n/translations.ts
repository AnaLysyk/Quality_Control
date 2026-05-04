// Sistema de Internacionalização (i18n) - Traduções PT/EN

export type Locale = "pt" | "en";

export interface Translations {
  // Common
  common: {
    search: string;
    filter: string;
    all: string;
    loading: string;
    error: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    create: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    yes: string;
    no: string;
    none: string;
    unknown: string;
    noResults: string;
    showMore: string;
    showLess: string;
  };

  // Brain Module
  brain: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    filters: {
      all: string;
      companies: string;
      applications: string;
      modules: string;
      defects: string;
      decisions: string;
      patterns: string;
    };
    stats: {
      nodes: string;
      edges: string;
      memories: string;
    };
    legend: {
      company: string;
      application: string;
      module: string;
      defect: string;
      pattern: string;
      decision: string;
      insight: string;
      other: string;
      hint: string;
    };
    panel: {
      details: string;
      type: string;
      connections: string;
      importance: string;
      createdAt: string;
      updatedAt: string;
      neighbors: string;
      memories: string;
      noNeighbors: string;
      noMemories: string;
      loadingMemories: string;
      selectNode: string;
    };
    empty: {
      title: string;
      description: string;
    };
    memoryTypes: {
      decision: string;
      rule: string;
      pattern: string;
      context: string;
      exception: string;
      technicalNote: string;
    };
  };

  // Navigation & Menus
  nav: {
    home: string;
    dashboard: string;
    tickets: string;
    companies: string;
    releases: string;
    metrics: string;
    settings: string;
    admin: string;
    profile: string;
    logout: string;
    notifications: string;
  };

  // Dashboard
  dashboard: {
    title: string;
    welcome: string;
    overview: string;
    recentActivity: string;
    pendingTasks: string;
    statistics: string;
  };

  // Tickets/Support
  tickets: {
    title: string;
    new: string;
    open: string;
    inProgress: string;
    resolved: string;
    closed: string;
    priority: {
      low: string;
      medium: string;
      high: string;
      critical: string;
    };
    type: {
      bug: string;
      feature: string;
      improvement: string;
      task: string;
    };
    status: {
      backlog: string;
      doing: string;
      review: string;
      done: string;
    };
  };

  // Quality
  quality: {
    passRate: string;
    failRate: string;
    blocked: string;
    notRun: string;
    total: string;
    passed: string;
    failed: string;
  };

  // Time
  time: {
    today: string;
    yesterday: string;
    thisWeek: string;
    thisMonth: string;
    ago: string;
    minutes: string;
    hours: string;
    days: string;
    months: string;
  };

  // Dates
  dates: {
    dateFormat: string;
    timeFormat: string;
    dateTimeFormat: string;
  };
}

export const translations: Record<Locale, Translations> = {
  pt: {
    common: {
      search: "Buscar",
      filter: "Filtrar",
      all: "Todos",
      loading: "Carregando...",
      error: "Erro",
      save: "Salvar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      delete: "Excluir",
      edit: "Editar",
      create: "Criar",
      close: "Fechar",
      back: "Voltar",
      next: "Próximo",
      previous: "Anterior",
      yes: "Sim",
      no: "Não",
      none: "Nenhum",
      unknown: "Desconhecido",
      noResults: "Nenhum resultado encontrado",
      showMore: "Ver mais",
      showLess: "Ver menos",
    },

    brain: {
      title: "Brain",
      subtitle: "Grafo de Conhecimento",
      searchPlaceholder: "Buscar no grafo...",
      filters: {
        all: "Todos",
        companies: "Empresas",
        applications: "Aplicações",
        modules: "Módulos",
        defects: "Defeitos",
        decisions: "Decisões",
        patterns: "Padrões",
      },
      stats: {
        nodes: "Nós",
        edges: "Conexões",
        memories: "Memórias",
      },
      legend: {
        company: "Empresa",
        application: "Aplicação",
        module: "Módulo",
        defect: "Defeito",
        pattern: "Padrão",
        decision: "Decisão",
        insight: "Insight",
        other: "Outros",
        hint: "Clique em um nó para detalhes",
      },
      panel: {
        details: "Detalhes",
        type: "Tipo",
        connections: "Conexões",
        importance: "Importância",
        createdAt: "Criado em",
        updatedAt: "Atualizado em",
        neighbors: "Vizinhos",
        memories: "Memórias Associadas",
        noNeighbors: "Sem conexões diretas",
        noMemories: "Nenhuma memória associada",
        loadingMemories: "Carregando memórias...",
        selectNode: "Selecione um nó no grafo",
      },
      empty: {
        title: "Nenhum nó encontrado",
        description: "O grafo de conhecimento está vazio ou não há nós correspondentes aos filtros.",
      },
      memoryTypes: {
        decision: "Decisão",
        rule: "Regra",
        pattern: "Padrão",
        context: "Contexto",
        exception: "Exceção",
        technicalNote: "Nota Técnica",
      },
    },

    nav: {
      home: "Início",
      dashboard: "Dashboard",
      tickets: "Chamados",
      companies: "Empresas",
      releases: "Releases",
      metrics: "Métricas",
      settings: "Configurações",
      admin: "Administração",
      profile: "Perfil",
      logout: "Sair",
      notifications: "Notificações",
    },

    dashboard: {
      title: "Dashboard",
      welcome: "Bem-vindo",
      overview: "Visão Geral",
      recentActivity: "Atividade Recente",
      pendingTasks: "Tarefas Pendentes",
      statistics: "Estatísticas",
    },

    tickets: {
      title: "Chamados",
      new: "Novo",
      open: "Aberto",
      inProgress: "Em Andamento",
      resolved: "Resolvido",
      closed: "Fechado",
      priority: {
        low: "Baixa",
        medium: "Média",
        high: "Alta",
        critical: "Crítica",
      },
      type: {
        bug: "Bug",
        feature: "Funcionalidade",
        improvement: "Melhoria",
        task: "Tarefa",
      },
      status: {
        backlog: "Backlog",
        doing: "Em Andamento",
        review: "Revisão",
        done: "Concluído",
      },
    },

    quality: {
      passRate: "Taxa de Aprovação",
      failRate: "Taxa de Falha",
      blocked: "Bloqueado",
      notRun: "Não Executado",
      total: "Total",
      passed: "Aprovados",
      failed: "Reprovados",
    },

    time: {
      today: "Hoje",
      yesterday: "Ontem",
      thisWeek: "Esta Semana",
      thisMonth: "Este Mês",
      ago: "atrás",
      minutes: "minutos",
      hours: "horas",
      days: "dias",
      months: "meses",
    },

    dates: {
      dateFormat: "dd/MM/yyyy",
      timeFormat: "HH:mm",
      dateTimeFormat: "dd/MM/yyyy HH:mm",
    },
  },

  en: {
    common: {
      search: "Search",
      filter: "Filter",
      all: "All",
      loading: "Loading...",
      error: "Error",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      edit: "Edit",
      create: "Create",
      close: "Close",
      back: "Back",
      next: "Next",
      previous: "Previous",
      yes: "Yes",
      no: "No",
      none: "None",
      unknown: "Unknown",
      noResults: "No results found",
      showMore: "Show more",
      showLess: "Show less",
    },

    brain: {
      title: "Brain",
      subtitle: "Knowledge Graph",
      searchPlaceholder: "Search the graph...",
      filters: {
        all: "All",
        companies: "Companies",
        applications: "Applications",
        modules: "Modules",
        defects: "Defects",
        decisions: "Decisions",
        patterns: "Patterns",
      },
      stats: {
        nodes: "Nodes",
        edges: "Edges",
        memories: "Memories",
      },
      legend: {
        company: "Company",
        application: "Application",
        module: "Module",
        defect: "Defect",
        pattern: "Pattern",
        decision: "Decision",
        insight: "Insight",
        other: "Other",
        hint: "Click a node for details",
      },
      panel: {
        details: "Details",
        type: "Type",
        connections: "Connections",
        importance: "Importance",
        createdAt: "Created at",
        updatedAt: "Updated at",
        neighbors: "Neighbors",
        memories: "Associated Memories",
        noNeighbors: "No direct connections",
        noMemories: "No associated memories",
        loadingMemories: "Loading memories...",
        selectNode: "Select a node on the graph",
      },
      empty: {
        title: "No nodes found",
        description: "The knowledge graph is empty or no nodes match the filters.",
      },
      memoryTypes: {
        decision: "Decision",
        rule: "Rule",
        pattern: "Pattern",
        context: "Context",
        exception: "Exception",
        technicalNote: "Technical Note",
      },
    },

    nav: {
      home: "Home",
      dashboard: "Dashboard",
      tickets: "Tickets",
      companies: "Companies",
      releases: "Releases",
      metrics: "Metrics",
      settings: "Settings",
      admin: "Admin",
      profile: "Profile",
      logout: "Logout",
      notifications: "Notifications",
    },

    dashboard: {
      title: "Dashboard",
      welcome: "Welcome",
      overview: "Overview",
      recentActivity: "Recent Activity",
      pendingTasks: "Pending Tasks",
      statistics: "Statistics",
    },

    tickets: {
      title: "Tickets",
      new: "New",
      open: "Open",
      inProgress: "In Progress",
      resolved: "Resolved",
      closed: "Closed",
      priority: {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "Critical",
      },
      type: {
        bug: "Bug",
        feature: "Feature",
        improvement: "Improvement",
        task: "Task",
      },
      status: {
        backlog: "Backlog",
        doing: "In Progress",
        review: "Review",
        done: "Done",
      },
    },

    quality: {
      passRate: "Pass Rate",
      failRate: "Fail Rate",
      blocked: "Blocked",
      notRun: "Not Run",
      total: "Total",
      passed: "Passed",
      failed: "Failed",
    },

    time: {
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This Week",
      thisMonth: "This Month",
      ago: "ago",
      minutes: "minutes",
      hours: "hours",
      days: "days",
      months: "months",
    },

    dates: {
      dateFormat: "MM/dd/yyyy",
      timeFormat: "h:mm a",
      dateTimeFormat: "MM/dd/yyyy h:mm a",
    },
  },
};

export function getTranslation(locale: Locale): Translations {
  return translations[locale];
}
