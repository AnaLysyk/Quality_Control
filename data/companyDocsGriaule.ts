export const COMPANY_DOCS_GRIAULE = {
  categories: [
    {
      id: "cat-griaule-smart-operador",
      slug: "smart-operador",
      title: "SMART Operador",
    },
  ],
  docs: [
    {
      id: "doc-griaule-smart-operador-homologacao",
      categoryId: "cat-griaule-smart-operador",
      status: "published",
      blocks: [
        {
          id: "smart-op-links",
          type: "table",
          rows: [["Swagger SMART API", "http://172.16.1.146:8100/swagger-ui.html#/"]],
        },
        {
          id: "smart-op-api-list",
          type: "list",
          items: [
            "Para biometria, o runner usa SC_BIOMETRICS_API_HOST, SC_BIOMETRICS_API_PORT, SC_BIOMETRICS_API_USER e SC_BIOMETRICS_API_PASSWORD configurados no deploy.",
          ],
        },
      ],
    },
  ],
} as const;
