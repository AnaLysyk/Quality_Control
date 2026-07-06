"use client";

export const dynamic = "force-dynamic";

import loadDynamic from "next/dynamic";
import styles from "./chat-theme.module.css";
import brainFinal from "./chat-brain-final.module.css";
import layoutFix from "./chat-layout-fix.module.css";
import sidebarFixes from "./chat-sidebar-fixes.module.css";
import modalFixes from "./chat-modal-fixes.module.css";

const Chat = loadDynamic(() => import("../components/TeamChat"), {
  ssr: false,
  loading: () => <div className="qc-chat-page-loading">Carregando chat...</div>,
});

export default function ChatPage() {
  const className = [
    styles.chatTheme,
    brainFinal.chatBrainFinal,
    layoutFix.chatLayoutFix,
    sidebarFixes.chatSidebarFixes,
    modalFixes.chatModalFixes,
    "qc-chat-page-shell",
  ].join(" ");

  return (
    <div className={className}>
      <Chat />
    </div>
  );
}
