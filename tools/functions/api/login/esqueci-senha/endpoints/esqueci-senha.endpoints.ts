export const endpointsEsqueciSenha = {
  solicitarRedefinicao: "/api/auth/forgot-password",
  redefinirComToken: "/api/auth/reset-via-token",
  validarToken: "/api/auth/reset-password/validate",
  confirmarNovaSenha: "/api/auth/reset-password/confirm",
} as const;

