"use client";

export const dynamic = "force-dynamic";

import loadDynamic from "next/dynamic";
import styles from "./chat-theme.module.css";

const Chat = loadDynamic(() => import("../components/TeamChat"), {
  ssr: false,
  loading: () => <div className="qc-chat-page-loading">Carregando chat...</div>,
});

export default function ChatPage() {
  return (
    <div className={`${styles.chatTheme} qc-chat-page-shell`}>
      <Chat />
    </div>
  );
}
