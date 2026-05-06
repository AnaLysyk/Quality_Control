"use client";

export const dynamic = "force-dynamic";
import loadDynamic from "next/dynamic";
const Chat = loadDynamic(() => import("../components/Chat"), { ssr: false, loading: () => <div>Carregando chat...</div> });

export default function ChatPage() {
  return <Chat />;
}
