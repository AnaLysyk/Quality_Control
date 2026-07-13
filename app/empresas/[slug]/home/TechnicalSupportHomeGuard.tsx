"use client";

/**
 * A navegação da home da empresa não deve decidir o destino do usuário.
 * O acesso já foi validado no servidor pelo contexto operacional. Manter
 * redirecionamentos concorrentes aqui criava o ciclo empresa -> admin -> empresa.
 */
export function TechnicalSupportHomeGuard() {
  return null;
}
