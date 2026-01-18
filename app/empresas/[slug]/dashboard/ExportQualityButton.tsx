"use client";
import { useAuth } from "@/context/AuthContext";

export function ExportQualityButton({ slug }: { slug: string }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "company") return null;
  return (
    <a
      href={`/api/empresas/${encodeURIComponent(slug)}/export?period=30d&format=csv`}
      download
      data-testid="export-quality"
      className="inline-flex items-center rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 mt-2 mb-4"
    >
      Exportar CSV
    </a>
  );
}
