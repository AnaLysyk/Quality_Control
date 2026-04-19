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
    "Collection importada do Postman e reorganizada por domínio para leitura rápida dentro da tela de automação.",
  groups: [
    {
      id: "tokens",
      title: "Tokens",
      summary: "Autenticação, web token, renovação e leitura de propriedades básicas.",
      requestCount: 5,
      sampleRequests: ["createTokenSisp", "createTokenGriaule", "create web token"],
    },
    {
      id: "processos",
      title: "Processos",
      summary: "Consulta, atualização, biometria, rejeição, envio ao GBDS e rotinas de processo.",
      requestCount: 28,
      sampleRequests: ["get Processo", "update Processo", "send Process To Gbds"],
    },
    {
      id: "pessoas",
      title: "Pessoas",
      summary: "Leitura de pessoa, laudo e manutenção de labels/listagens.",
      requestCount: 5,
      sampleRequests: ["get Pessoa", "get Laudo", "list Pessoas NEW"],
    },
    {
      id: "cardscan",
      title: "Cardscan",
      summary: "Profile, process e layout com leitura, exclusão e submissão.",
      requestCount: 9,
      sampleRequests: ["get Profile", "new Process", "submit Layout"],
    },
    {
      id: "config",
      title: "Config",
      summary: "Parâmetros auxiliares como municípios e regras de isenção.",
      requestCount: 2,
      sampleRequests: ["get Municipios", "listExemption"],
    },
    {
      id: "rfb",
      title: "RFB",
      summary: "Fluxos de CPF, inclusão CIN e consulta de concluídos.",
      requestCount: 3,
      sampleRequests: ["includeCIN", "getCPFReceita", "listCinConcluido"],
    },
    {
      id: "package",
      title: "Package",
      summary: "Consulta e recebimento de pacotes de integração.",
      requestCount: 2,
      sampleRequests: ["getPackage", "receivePackage"],
    },
    {
      id: "sefaz",
      title: "Sefaz",
      summary: "Geração de DAE para o fluxo fiscal.",
      requestCount: 1,
      sampleRequests: ["generateDAE"],
    },
    {
      id: "attention",
      title: "Attention",
      summary: "Criação, desativação e listagem de casos de atenção.",
      requestCount: 3,
      sampleRequests: ["Create Attention Case", "Deactivate Attention Case", "list Attention Case"],
    },
    {
      id: "users",
      title: "Usuários",
      summary: "Cadastro, leitura, exclusão e vínculo de estações.",
      requestCount: 5,
      sampleRequests: ["listUser", "createUser", "addUserStations"],
    },
    {
      id: "cidadao-smart",
      title: "Cidadão Smart",
      summary: "Fluxos públicos relacionados ao keycloak e solicitações do cidadão.",
      requestCount: 4,
      sampleRequests: ["keycloak nkey", "consulta-status-processo", "solicitação-segunda-via-expressa"],
    },
  ] satisfies SCIntegrationRequestGroup[],
} as const;
