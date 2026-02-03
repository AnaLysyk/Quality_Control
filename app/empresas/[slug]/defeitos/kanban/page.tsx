"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Kanban from "@/components/Kanban";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { KanbanData } from "@/types/kanban";

const DEFAULT_KANBAN: KanbanData = {
  pass: [],
  fail: [
    {
      id: "k2",
      title: "Erro no login",
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
    },
  ],
  blocked: [],
  notRun: [],
};

function readLocal(key: string): KanbanData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KanbanData;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: KanbanData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export default function CompanyKanbanPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const companySlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const { user } = useAuthUser();

  const storageKey = useMemo(() => `qc-kanban:${companySlug ?? "default"}`, [companySlug]);
  const [data, setData] = useState<KanbanData>(() => readLocal(storageKey) ?? DEFAULT_KANBAN);

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : "";
  const canEdit = Boolean(user?.isGlobalAdmin || role === "admin" || role === "company");

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c) px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Kanban</p>
          <h1 className="mt-2 text-3xl font-extrabold">Kanban de defeitos</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Visualize o fluxo de defeitos por status e exporte o CSV.
          </p>
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <Kanban
            data={data}
            project={(companySlug ?? "GRIAULE").toString()}
            runId={1}
            companySlug={companySlug}
            editable={canEdit}
            allowStatusChange={canEdit}
            onChange={(next) => {
              setData(next);
              writeLocal(storageKey, next);
            }}
          />
        </div>
      </div>
    </div>
  );
}
