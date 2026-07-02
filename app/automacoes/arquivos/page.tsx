"use client";

import { redirect } from "next/navigation";

export default function AutomacoesArquivosPage() {
  redirect("/automacoes/base64?tab=library");
}

