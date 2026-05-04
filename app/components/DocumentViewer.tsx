"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiFileText, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";

import styles from "./DocumentViewer.module.css";

export interface DocumentViewerItem {
  id: string;
  title: string;
  fileName?: string | null;
  url?: string | null;
  kind: "file" | "link";
}

type ViewerCopy = {
  close: string;
  viewerDownload?: string;
  viewerPdfHint?: string;
  viewerUnsupported?: string;
};

interface DocumentViewerProps {
  open: boolean;
  item: DocumentViewerItem | null;
  slug: string;
  onClose: () => void;
  copy: ViewerCopy;
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200] as const;

const ZOOM_CLASS_BY_LEVEL: Record<(typeof ZOOM_LEVELS)[number], string> = {
  50: styles.zoom50,
  75: styles.zoom75,
  100: styles.zoom100,
  125: styles.zoom125,
  150: styles.zoom150,
  175: styles.zoom175,
  200: styles.zoom200,
};

function normalizeZoomIndex(index: number) {
  if (index < 0) return 0;
  if (index >= ZOOM_LEVELS.length) return ZOOM_LEVELS.length - 1;
  return index;
}

export default function DocumentViewer({ open, item, slug, onClose, copy }: DocumentViewerProps) {
  const [zoomIndex, setZoomIndex] = useState(2);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobError, setBlobError] = useState(false);
  const prevBlobRef = useRef<string | null>(null);

  const zoomLevel = ZOOM_LEVELS[zoomIndex] ?? 100;
  const zoomClassName = ZOOM_CLASS_BY_LEVEL[zoomLevel];

  const fileName = item?.fileName?.toLowerCase() || "";
  const isPdf = fileName.endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);

  const fileUrl = useMemo(() => {
    if (!item) return "";
    return `/api/company-documents?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(item.id)}&download=1`;
  }, [item, slug]);

  const downloadUrl = fileUrl;

  // Fetch file as blob so auth cookies are sent (iframes don't send cookies)
  useEffect(() => {
    if (!open || !item || (!isPdf && !isImage)) {
      setBlobUrl(null);
      setBlobError(false);
      return;
    }
    let cancelled = false;
    setBlobUrl(null);
    setBlobError(false);
    fetch(fileUrl, { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json") || ct.includes("text/html")) {
          throw new Error("unexpected content-type");
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const expectedType = isPdf ? "application/pdf" : blob.type;
        const typed = blob.type === expectedType ? blob : new Blob([blob], { type: expectedType });
        const url = URL.createObjectURL(typed);
        prevBlobRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBlobError(true);
      });
    return () => {
      cancelled = true;
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileUrl]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-(--tc-border,#d7deea) px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-(--tc-text-primary,#0b1a3c)">{item.title}</h2>
            {item.fileName ? (
              <p className="mt-1 wrap-break-word text-xs text-(--tc-text-muted,#6b7280)">{item.fileName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-secondary,#4b5563) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            aria-label={copy.close}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-100">
          {isImage ? (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-6">
              <div className={styles.imageStage}>
                {blobUrl ? (
                  <img src={blobUrl} alt={item.title} className={`${styles.viewerImage} ${zoomClassName}`} />
                ) : blobError ? (
                  <p className="text-sm text-red-600">Não foi possível carregar o arquivo.</p>
                ) : (
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--tc-border) border-t-(--tc-accent,#ef0001)" />
                )}
              </div>
            </div>
          ) : null}

          {isPdf ? (
            <div className="h-full w-full bg-slate-200 p-2 sm:p-3">
              {blobUrl ? (
                <iframe
                  src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  title={item.title}
                  className={styles.viewerFrame}
                />
              ) : blobError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-red-600">Não foi possível carregar o PDF.</p>
                  <a href={downloadUrl} className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)">
                    <FiDownload className="h-4 w-4" /> {copy.viewerDownload ?? "Baixar"}
                  </a>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
                </div>
              )}
            </div>
          ) : null}

          {!isImage && !isPdf ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-18 w-18 items-center justify-center rounded-3xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-muted,#6b7280)">
                <FiFileText className="h-8 w-8" />
              </div>
              <p className="max-w-md text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                {copy.viewerUnsupported ?? "Visualizacao indisponivel para este tipo de arquivo."}
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
              >
                <FiDownload className="h-4 w-4" /> {copy.viewerDownload ?? "Baixar"}
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--tc-border,#d7deea) px-4 py-4 sm:px-6">
          <div className="flex min-h-10 items-center gap-2 text-sm text-(--tc-text-secondary,#4b5563)">
            {isImage ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoomIndex((current) => normalizeZoomIndex(current - 1))}
                  disabled={zoomIndex === 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Zoom out"
                >
                  <FiZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-14 text-center font-semibold">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomIndex((current) => normalizeZoomIndex(current + 1))}
                  disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--tc-border,#d7deea) bg-white text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001) disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Zoom in"
                >
                  <FiZoomIn className="h-4 w-4" />
                </button>
              </>
            ) : null}
            {isPdf ? <span>{copy.viewerPdfHint ?? "Use os controles do PDF para navegar entre paginas e ajustar o zoom."}</span> : null}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              <FiDownload className="h-4 w-4" /> {copy.viewerDownload ?? "Baixar"}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-white px-3 py-2 text-sm font-semibold text-(--tc-text-primary,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
            >
              {copy.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
