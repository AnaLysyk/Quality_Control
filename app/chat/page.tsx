"use client";

export const dynamic = "force-dynamic";
import loadDynamic from "next/dynamic";
const Chat = loadDynamic(() => import("../components/Chat"), { ssr: false, loading: () => <div>Carregando chat...</div> });

export default function ChatPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Chat</h1>
      <Chat />
    </div>
  );
}
