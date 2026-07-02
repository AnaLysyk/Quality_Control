export type SCIntegrationRequestGroup = {
  id: string;
  title: string;
  summary: string;
  requestCount: number;
  sampleRequests: string[];
};

export const SC_INTEGRATION_COLLECTION = {
  name: "SC Integration API v2",
  totalRequests: 67,
  summary:
    "Collection importada do Postman e reorganizada por domÃ­nio para leitura rÃ¡pida dentro da tela de automaÃ§Ã£o.",
  groups: [
    {
      id: "tokens",
      title: "Tokens",
      summary: "AutenticaÃ§Ã£o, web token, renovaÃ§Ã£o e leitura de propriedades bÃ¡sicas.",
      requestCount: 5,
      sampleRequests: ["createTokenSisp", "createTokenGriaule", "create web token"],
    },
    {
      id: "processos",
      title: "Processos",
      summary: "Consulta, atualizaÃ§Ã£o, biometria, rejeiÃ§Ã£o, envio ao GBDS e rotinas de processo.",
      requestCount: 28,
      sampleRequests: ["get Processo", "update Processo", "send Process To Gbds"],
    },
    {
      id: "pessoas",
      title: "Pessoas",
      summary: "Leitura de pessoa, laudo e manutenÃ§Ã£o de labels/listagens.",
      requestCount: 5,
      sampleRequests: ["get Pessoa", "get Laudo", "list Pessoas NEW"],
    },
    {
      id: "cardscan",
      title: "Cardscan",
      summary: "Profile, process e layout com leitura, exclusÃ£o e submissÃ£o.",
      requestCount: 9,
      sampleRequests: ["get Profile", "new Process", "submit Layout"],
    },
    {
      id: "config",
      title: "Config",
      summary: "ParÃ¢metros auxiliares como municÃ­pios e regras de isenÃ§Ã£o.",
      requestCount: 2,
      sampleRequests: ["get Municipios", "listExemption"],
    },
    {
      id: "rfb",
      title: "RFB",
      summary: "Fluxos de CPF, inclusÃ£o CIN e consulta de concluÃ­dos.",
      requestCount: 3,
      sampleRequests: ["includeCIN", "getCPFReceita", "listCinConcluido"],
    },
    {
      id: "package",
      title: "Package",
      summary: "Consulta e recebimento de pacotes de integraÃ§Ã£o.",
      requestCount: 2,
      sampleRequests: ["getPackage", "receivePackage"],
    },
    {
      id: "sefaz",
      title: "Sefaz",
      summary: "GeraÃ§Ã£o de DAE para o fluxo fiscal.",
      requestCount: 1,
      sampleRequests: ["generateDAE"],
    },
    {
      id: "attention",
      title: "Attention",
      summary: "CriaÃ§Ã£o, desativaÃ§Ã£o e listagem de casos de atenÃ§Ã£o.",
      requestCount: 3,
      sampleRequests: ["Create Attention Case", "Deactivate Attention Case", "list Attention Case"],
    },
    {
      id: "users",
      title: "UsuÃ¡rios",
      summary: "Cadastro, leitura, exclusÃ£o e vÃ­nculo de estaÃ§Ãµes.",
      requestCount: 5,
      sampleRequests: ["listUser", "createUser", "addUserStations"],
    },
    {
      id: "cidadao-smart",
      title: "CidadÃ£o Smart",
      summary: "Fluxos pÃºblicos relacionados ao keycloak e solicitaÃ§Ãµes do cidadÃ£o.",
      requestCount: 4,
      sampleRequests: ["keycloak nkey", "consulta-status-processo", "solicitaÃ§Ã£o-segunda-via-expressa"],
    },
  ] satisfies SCIntegrationRequestGroup[],
} as const;

