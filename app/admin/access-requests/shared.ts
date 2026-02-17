// Arquivo criado para eliminar erro de importação

export type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  jobRole: string;
  accessType: string;
  clientId: string | null;
  company: string;
  notes: string;
  rawMessage: string;
  adminNotes: string | null;
};

export type AccessTypeLabel = string;
export type ClientOption = { id: string; name: string };
export type RawSupportRequest = { id: string; created_at: string; status?: string; email?: string; message?: string; admin_notes?: string };

export function parseFromMessage(message: string, email: string): Partial<AccessRequestItem> {
  // Implementação mínima para evitar erro
  return { email };
}
