"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FiLogOut, FiUser } from "react-icons/fi";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <h1 className="text-lg font-bold text-[#0b1a3c]">Painel Admin</h1>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/me")}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-black"
          >
            <FiUser />
            Perfil
          </button>

          <button
            onClick={() => router.push("/logout")}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
          >
            <FiLogOut />
            Sair
          </button>
        </div>
      </header>
      {children}
    </>
  );
}
