"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Kanban from "@/components/Kanban";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { KanbanData } from "@/types/kanban";

const baseKanban: KanbanData = {
  pass: [{ id: "k1", title: "Login ok", bug: null }],
  fail: [{ id: "k2", title: "Erro no login", bug: null }],
  blocked: [{ id: "k3", title: "Dependencia externa", bug: null }],
  notRun: [{ id: "k4", title: "Caso nao executado", bug: null }],
};

function isKanbanData(value: unknown): value is KanbanData {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.pass) && Array.isArray(obj.fail) && Array.isArray(obj.blocked) && Array.isArray(obj.notRun);
}

export default function KanbanDefeitosPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "default";
  const storageKey = useMemo(() => `kanban-${slug}`, [slug]);
  const [data, setData] = useState<KanbanData>(baseKanban);
  const { user } = useAuthUser();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (isKanbanData(parsed)) {
        setData(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  const canEdit = user?.role === "admin";

  const handleChange = (next: KanbanData) => {
    setData(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-(--page-bg,#f7f9fb) text-(--page-text,#0b1a3c) px-4 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Kanban</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Kanban de defeitos</h1>
          <p className="text-sm text-(--tc-text-secondary,#4b5563)">
            Dados locais por empresa. Admin pode mover cards entre colunas.
          </p>
        </header>

        <Kanban
          data={data}
          project="demo"
          runId={1}
          companySlug={slug}
          editable={canEdit}
          allowStatusChange={canEdit}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
