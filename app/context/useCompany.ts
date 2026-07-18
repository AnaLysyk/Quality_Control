import { useClientContext } from "./ClientContext";

export function useCompany() {
  return useClientContext();
}

