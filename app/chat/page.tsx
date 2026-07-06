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
      <style jsx global>{`
        body:not(.dark):not([data-theme="dark"]) .qc-chat-page-shell,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-page-shell,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell {
          --tc-bg: #f7faff !important;
          --tc-surface: #ffffff !important;
          --tc-surface-2: #f8fbff !important;
          --tc-border: rgba(15, 23, 42, 0.12) !important;
          --tc-text-primary: #061225 !important;
          --tc-text-muted: #50627d !important;
          background:
            radial-gradient(circle at 18% 12%, rgba(59, 130, 246, 0.11), transparent 34%),
            radial-gradient(circle at 92% 84%, rgba(239, 0, 1, 0.045), transparent 30%),
            linear-gradient(135deg, #ffffff 0%, #f7faff 54%, #edf4ff 100%) !important;
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell main,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell main {
          background:
            radial-gradient(circle at 35% 10%, rgba(59, 130, 246, 0.08), transparent 30%),
            radial-gradient(circle at 90% 88%, rgba(239, 0, 1, 0.04), transparent 28%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 250, 255, 0.98)) !important;
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell header,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell form,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell header,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell form {
          border-color: rgba(15, 23, 42, 0.12) !important;
          background: rgba(255, 255, 255, 0.92) !important;
          color: #061225 !important;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06) !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell header h1,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell h1,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell h2,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell h3,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell p,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell span,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell header h1,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell h1,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell h2,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell h3,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell p,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell span {
          color: inherit;
          text-shadow: none !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell [class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell [class*="text-white"] {
          color: #334155 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell header [class*="text-white"],
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h1[class*="text-white"],
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h2[class*="text-white"],
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h3[class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell header [class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h1[class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h2[class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell main h3[class*="text-white"] {
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell form [class*="rounded-[28px]"],
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell form [class*="rounded-"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell form [class*="rounded-[28px]"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell form [class*="rounded-"] {
          border-color: rgba(1, 24, 72, 0.18) !important;
          background: rgba(255, 255, 255, 0.96) !important;
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell textarea,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell input,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell textarea,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell input {
          background: transparent !important;
          color: #061225 !important;
          -webkit-text-fill-color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell textarea::placeholder,
        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell input::placeholder,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell textarea::placeholder,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell input::placeholder {
          color: #50627d !important;
          opacity: 1 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell aside,
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell aside {
          border-color: rgba(15, 23, 42, 0.12) !important;
          background:
            radial-gradient(circle at 0% 0%, rgba(59, 130, 246, 0.1), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 248, 255, 0.98)) !important;
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .qc-chat-shell aside [class*="text-white"],
        html:not(.dark):not([data-theme="dark"]) .qc-chat-shell aside [class*="text-white"] {
          color: #50627d !important;
        }
      `}</style>
      <Chat />
    </div>
  );
}
