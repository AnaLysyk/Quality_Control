import { useClientContext } from "./CompanyContext";

export function useCompany() {
  return useClientContext();
}
