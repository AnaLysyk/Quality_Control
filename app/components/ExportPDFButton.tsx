"use client";

import { useState } from "react";

interface ExportPDFButtonProps {
  fileName: string;
  targetId?: string;
  companySlug?: string;
}

export default function ExportPDFButton({ fileName, companySlug }: ExportPDFButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  async function handleExport() {
    setExported(false);
    setExporting(true);

    try {
      const company = companySlug || "demo";
      const url = `/api/empresas/${encodeURIComponent(company)}/releases/${encodeURIComponent(fileName)}/export?format=pdf`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setExported(true);
    } catch (error) {
      console.error("Erro ao gerar PDF", error);
      // Fallback: redirect to server endpoint directly
      const fallbackUrl = `/api/export-pdf?fileName=${encodeURIComponent(fileName)}&company=${encodeURIComponent(companySlug || "demo")}`;
      const link = document.createElement("a");
      link.href = fallbackUrl;
      link.download = `${fileName}.pdf`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExported(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        data-testid="export-pdf"
        type="button"
        onClick={handleExport}
        disabled={exporting}
        aria-disabled={exporting}
        className="inline-flex items-center justify-center rounded-full bg-white text-[#0b1a3c] border border-white/60 px-3 py-2 hover:shadow-md hover:scale-[1.02] transition focus:outline-none disabled:opacity-60"
        aria-label="Exportar PDF"
        title="Baixar PDF desta run"
      >
        <span className="text-lg font-bold leading-none">{String.fromCharCode(0x2193)}</span>
      </button>
      {exporting && (
        <span data-testid="export-loading" className="text-xs text-white/80">
          Gerando...
        </span>
      )}
      {!exporting && exported && (
        <span data-testid="export-success" className="text-xs text-white/80">
          Exportado
        </span>
      )}
    </div>
  );
}

