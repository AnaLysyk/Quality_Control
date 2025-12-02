type ReleaseEntry = {
  title: string;
  summary: string;
  runId: number;
  app: string;
};

export const releaseOrder = [
  "v1_8_0_reg",
  "v1_8_0_ace",
  "v1_7_0_reg",
  "v1_7_0_ace_s3",
  "v1_7_0_ace_s12",
  "v1_6_2_reg",
  "v1_6_2_ace",
  "print_v1_8_0_ace",
] as const;

export type ReleaseId = (typeof releaseOrder)[number];

export const releasesData: Record<ReleaseId, ReleaseEntry> = {
  v1_8_0_reg: {
    title: "Release 1.8.0 - Regressao",
    summary: "Execucao completa do ciclo de regressao 1.8.0.",
    runId: 17,
    app: "smart",
  },
  v1_8_0_ace: {
    title: "Release 1.8.0 - Aceitacao",
    summary: "Validacoes de aceitacao para a 1.8.0.",
    runId: 15,
    app: "smart",
  },
  v1_7_0_reg: {
    title: "Release 1.7.0 - Regressao",
    summary: "Execucao completa do ciclo de regressao 1.7.0.",
    runId: 14,
    app: "smart",
  },
  v1_7_0_ace_s3: {
    title: "Release 1.7.0 - Aceitacao (Sprint 3)",
    summary: "Execucao de aceitacao sprint 3 da 1.7.0.",
    runId: 12,
    app: "smart",
  },
  v1_7_0_ace_s12: {
    title: "Release 1.7.0 - Aceitacao (Sprint 1/2)",
    summary: "Execucao de aceitacao sprint 1/2 da 1.7.0.",
    runId: 11,
    app: "smart",
  },
  v1_6_2_reg: {
    title: "Release 1.6.2 - Regressao",
    summary: "Execucao de regressao da release base 1.6.2.",
    runId: 10,
    app: "smart",
  },
  v1_6_2_ace: {
    title: "Release 1.6.2 - Aceitacao",
    summary: "Plano de aceitacao da release base 1.6.2.",
    runId: 10,
    app: "smart",
  },
  print_v1_8_0_ace: {
    title: "Release 1.8.0 - Aceitacao (PRINT)",
    summary: "Execucao da aceitacao do PRINT na release 1.8.0.",
    runId: 3,
    app: "print",
  },
};
