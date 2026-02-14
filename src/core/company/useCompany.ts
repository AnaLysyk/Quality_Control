// Hook de acesso ao contexto de empresa/cliente (CompanyContext).
// Facilita importação e uso em componentes.
import { useClientContext } from "./CompanyContext";

/**
 * Hook para acessar o contexto de empresa/cliente.
 * Alias para useClientContext.
 */
export function useCompany() {
  return useClientContext();
}
