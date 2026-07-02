import { NotificationOperationPanel } from "./_components/NotificationOperationPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notificações",
  description: "Central de notificações por empresa, perfil e Brain",
};

export default function NotificacoesPage() {
  return <NotificationOperationPanel />;
}

