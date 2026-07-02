import { UnifiedConversationsHub } from "./_components/UnifiedConversationsHub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conversas",
  description: "Hub unificado de conversas por empresa, perfil e Brain",
};

export default function ConversasPage() {
  return <UnifiedConversationsHub />;
}

