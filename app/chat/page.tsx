"use client";

export const dynamic = "force-dynamic";

import loadDynamic from "next/dynamic";
import styles from "./chat-theme.module.css";
import brainPolish from "./chat-brain-polish.module.css";
import sidebarFixes from "./chat-sidebar-fixes.module.css";

const Chat = loadDynamic(() => import("../components/TeamChat"), {
  ssr: false,
  loading: () => <div className="qc-chat-page-loading">Carregando chat...</div>,
});

export default function ChatPage() {
  return (
    <div className={`${styles.chatTheme} ${brainPolish.chatBrainPolish} ${sidebarFixes.chatSidebarFixes} qc-chat-page-shell`}>
      <Chat />
    </div>
  );
}
