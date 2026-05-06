"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiBookOpen, FiChevronDown, FiChevronRight, FiChevronLeft, FiCode, FiDatabase,
  FiEdit2, FiGrid, FiLayers, FiMenu, FiPlus, FiSave, FiSettings,
  FiTrash2, FiX, FiAlertTriangle, FiCheckCircle, FiInfo, FiAlertCircle,
  FiZap, FiArrowUp, FiArrowDown, FiCopy, FiCheck, FiFileText,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";
import styles from "./DocsWikiClient.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = "draft" | "published" | "outdated";

type DocBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "card"; variant: "info" | "warning" | "danger" | "success" | "tip"; title?: string; text: string }
  | { id: string; type: "code"; language: string; code: string; caption?: string }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | { id: string; type: "divider" }
  | { id: string; type: "table"; headers: string[]; rows: string[][]; caption?: string };

type WikiCategory = {
  id: string; slug: string; title: string; description?: string;
  icon?: string; order: number; createdAt: string; updatedAt: string; createdBy?: string | null;
};

type WikiDoc = {
  id: string; categoryId: string; slug: string; title: string;
  description?: string; status: DocStatus; order: number; blocks: DocBlock[];
  createdAt: string; updatedAt: string; createdBy?: string | null; updatedBy?: string | null;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMarkup(text: string) {
  const safe = escHtml(text);
  return safe
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class=\"px-1 py-0.5 rounded bg-[#f3f4f6] text-[#1f2937] text-[0.85em] font-mono\">$1</code>");
}

const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  outdated: "Desativado",
};

const STATUS_CLASS: Record<DocStatus, string> = {
  draft: "bg-[#fef9c3] text-[#854d0e]",
  published: "bg-[#dcfce7] text-[#166534]",
  outdated: "bg-[#e2e8f0] text-[#475569]",
};

const ICON_OPTIONS = [
  { value: "FiBookOpen", label: "Livro", Icon: FiBookOpen },
  { value: "FiCode", label: "Código", Icon: FiCode },
  { value: "FiDatabase", label: "Banco", Icon: FiDatabase },
  { value: "FiLayers", label: "Camadas", Icon: FiLayers },
  { value: "FiSettings", label: "Config", Icon: FiSettings },
  { value: "FiGrid", label: "Grid", Icon: FiGrid },
  { value: "FiFileText", label: "Arquivo", Icon: FiFileText },
];

function CategoryIcon({ icon }: { icon?: string }) {
  const found = ICON_OPTIONS.find((o) => o.value === icon);
  const Icon = found?.Icon ?? FiBookOpen;
  return <Icon className="shrink-0" />;
}

// ─── Block Viewer ─────────────────────────────────────────────────────────────

function BlockViewer({ block }: { block: DocBlock }) {
  const [copied, setCopied] = useState(false);

  if (block.type === "heading") {
    const classes = block.level === 1
      ? "text-2xl font-extrabold text-[#0b1a3c] mt-8 mb-3"
      : block.level === 2
      ? "text-xl font-bold text-[#0b1a3c] mt-6 mb-2"
      : "text-base font-semibold text-[#0b1a3c] mt-4 mb-1";
    const Tag = `h${block.level}` as "h1" | "h2" | "h3";
    return <Tag className={classes}>{block.text}</Tag>;
  }

  if (block.type === "paragraph") {
    return (
      <p
        className="text-sm leading-relaxed text-[#374151] mb-3"
        dangerouslySetInnerHTML={{ __html: inlineMarkup(block.text) }}
      />
    );
  }

  if (block.type === "divider") {
    return <hr className="my-6 border-t border-[#e5e7eb]" />;
  }

  if (block.type === "list") {
    const Tag = block.ordered ? "ol" : "ul";
    return (
      <Tag className={`mb-3 pl-5 text-sm text-[#374151] space-y-1 ${block.ordered ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkup(item) }} />
        ))}
      </Tag>
    );
  }

  if (block.type === "code") {
    const handleCopy = () => {
      navigator.clipboard.writeText(block.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    };
    return (
      <div className="mb-4 rounded-lg overflow-hidden border border-[#e5e7eb]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#f3f4f6] border-b border-[#e5e7eb]">
          <span className="text-xs font-mono text-[#6b7280]">{block.language || "code"}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#374151] transition-colors"
          >
            {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono bg-[#1e1e2e] text-[#cdd6f4] leading-relaxed">
          <code>{block.code}</code>
        </pre>
        {block.caption && <p className="px-3 py-1.5 text-xs text-[#6b7280] bg-[#f9fafb]">{block.caption}</p>}
      </div>
    );
  }

  if (block.type === "card") {
    const variantStyles: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
      info: { bg: "bg-[#eff6ff]", border: "border-t-[#bfdbfe] border-r-[#bfdbfe] border-l-[#bfdbfe] border-b-2 border-b-[#bfdbfe]", text: "text-[#1e40af]", icon: <FiInfo size={16} /> },
      warning: { bg: "bg-[#fffbeb]", border: "border-t-[#fde68a] border-r-[#fde68a] border-l-[#fde68a] border-b-2 border-b-[#fde68a]", text: "text-[#92400e]", icon: <FiAlertTriangle size={16} /> },
      danger: { bg: "bg-[#fef2f2]", border: "border-t-[#fecaca] border-r-[#fecaca] border-l-[#fecaca] border-b-2 border-b-[#fecaca]", text: "text-[#991b1b]", icon: <FiAlertCircle size={16} /> },
      success: { bg: "bg-[#f0fdf4]", border: "border-t-[#bbf7d0] border-r-[#bbf7d0] border-l-[#bbf7d0] border-b-2 border-b-[#bbf7d0]", text: "text-[#166534]", icon: <FiCheckCircle size={16} /> },
      tip: { bg: "bg-[#f5f3ff]", border: "border-t-[#ddd6fe] border-r-[#ddd6fe] border-l-[#ddd6fe] border-b-2 border-b-[#ddd6fe]", text: "text-[#5b21b6]", icon: <FiZap size={16} /> },
    };
    const s = variantStyles[block.variant] ?? variantStyles.info;
    return (
      <div className={`mb-4 rounded-lg border-t border-r border-l p-4 ${s.bg} ${s.border}`}>
        <div className={`flex items-start gap-2 ${s.text}`}>
          <span className="mt-0.5 shrink-0">{s.icon}</span>
          <div className="min-w-0">
            {block.title && <p className="font-semibold text-sm mb-1">{block.title}</p>}
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkup(block.text) }} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="mb-4 overflow-x-auto rounded-lg border border-[#e5e7eb]">
        <table className="w-full text-sm">
          {block.headers.length > 0 && (
            <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="px-4 py-2 text-left font-semibold text-[#374151] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb]">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2 text-[#374151]" dangerouslySetInnerHTML={{ __html: inlineMarkup(cell) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.caption && <p className="px-4 py-2 text-xs text-[#6b7280] bg-[#f9fafb] border-t border-[#f3f4f6]">{block.caption}</p>}
      </div>
    );
  }

  return null;
}

// ─── Block Editor ─────────────────────────────────────────────────────────────

function BlockEditor({
  block,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  block: DocBlock;
  onUpdate: (b: DocBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const controls = (
    <div className="flex items-center gap-1 shrink-0">
      <button disabled={isFirst} onClick={onMoveUp} className="p-1 rounded hover:bg-[#f3f4f6] disabled:opacity-30" title="Mover acima"><FiArrowUp size={13} /></button>
      <button disabled={isLast} onClick={onMoveDown} className="p-1 rounded hover:bg-[#f3f4f6] disabled:opacity-30" title="Mover abaixo"><FiArrowDown size={13} /></button>
      {confirmDelete ? (
        <>
          <span className="text-xs text-[#dc2626]">Confirmar?</span>
          <button onClick={onDelete} className="px-2 py-0.5 rounded text-xs bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca]">Sim</button>
          <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 rounded text-xs bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]">Não</button>
        </>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="p-1 rounded hover:bg-[#fee2e2] text-[#6b7280] hover:text-[#dc2626]" title="Deletar bloco"><FiTrash2 size={13} /></button>
      )}
    </div>
  );

  const wrap = (label: string, content: React.ReactNode) => (
    <div className="group border border-[#e5e7eb] rounded-lg p-3 bg-[#ffffff] hover:border-[#d1d5db]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">{label}</span>
        {controls}
      </div>
      {content}
    </div>
  );

  if (block.type === "heading") {
    return wrap("Título", (
      <div className="flex gap-2">
        <select
          aria-label="Nível do título"
          value={block.level}
          onChange={(e) => onUpdate({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
          className="border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] shrink-0"
        >
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
        </select>
        <input
          type="text"
          value={block.text}
          onChange={(e) => onUpdate({ ...block, text: e.target.value })}
          placeholder="Texto do título..."
          className="flex-1 border border-[#e5e7eb] rounded px-2 py-1 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
        />
      </div>
    ));
  }

  if (block.type === "paragraph") {
    return wrap("Parágrafo", (
      <textarea
        value={block.text}
        onChange={(e) => onUpdate({ ...block, text: e.target.value })}
        placeholder="Texto... use **negrito**, _itálico_, `código`"
        rows={3}
        className="w-full border border-[#e5e7eb] rounded px-2 py-1 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1] resize-y"
      />
    ));
  }

  if (block.type === "divider") {
    return wrap("Divisor", <p className="text-xs text-[#9ca3af] italic">Sem configurações</p>);
  }

  if (block.type === "card") {
    const variants = ["info", "warning", "danger", "success", "tip"] as const;
    return wrap("Card", (
      <div className="space-y-2">
        <div className="flex gap-2">
          <select
            aria-label="Variante do card"
            value={block.variant}
            onChange={(e) => onUpdate({ ...block, variant: e.target.value as typeof block.variant })}
            className="border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] shrink-0"
          >
            {variants.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input
            type="text"
            value={block.title ?? ""}
            onChange={(e) => onUpdate({ ...block, title: e.target.value || undefined })}
            placeholder="Título do card (opcional)"
            className="flex-1 border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
          />
        </div>
        <textarea
          value={block.text}
          onChange={(e) => onUpdate({ ...block, text: e.target.value })}
          placeholder="Conteúdo do card..."
          rows={2}
          className="w-full border border-[#e5e7eb] rounded px-2 py-1 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1] resize-y"
        />
      </div>
    ));
  }

  if (block.type === "code") {
    return wrap("Código", (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={block.language}
            onChange={(e) => onUpdate({ ...block, language: e.target.value })}
            placeholder="Linguagem (ex: typescript)"
            className="flex-1 border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
          />
          <input
            type="text"
            value={block.caption ?? ""}
            onChange={(e) => onUpdate({ ...block, caption: e.target.value || undefined })}
            placeholder="Legenda (opcional)"
            className="flex-1 border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
          />
        </div>
        <textarea
          value={block.code}
          onChange={(e) => onUpdate({ ...block, code: e.target.value })}
          placeholder="Código..."
          rows={5}
          className="w-full border border-[#e5e7eb] rounded px-2 py-1 text-xs font-mono text-[#374151] bg-[#f9fafb] outline-none focus:border-[#6366f1] resize-y"
        />
      </div>
    ));
  }

  if (block.type === "list") {
    return wrap("Lista", (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-[#6b7280]">
          <input
            type="checkbox"
            checked={block.ordered}
            onChange={(e) => onUpdate({ ...block, ordered: e.target.checked })}
          />
          Lista ordenada
        </label>
        <div className="space-y-1">
          {block.items.map((item, i) => (
            <div key={i} className="flex gap-1">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const items = [...block.items];
                  items[i] = e.target.value;
                  onUpdate({ ...block, items });
                }}
                placeholder={`Item ${i + 1}`}
                className="flex-1 border border-[#e5e7eb] rounded px-2 py-1 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              />
              <button
                type="button"
                onClick={() => onUpdate({ ...block, items: block.items.filter((_, j) => j !== i) })}
                className="p-1 rounded hover:bg-[#fee2e2] text-[#6b7280] hover:text-[#dc2626]"
                title="Remover item"
              ><FiX size={12} /></button>
            </div>
          ))}
        </div>
        <button
          onClick={() => onUpdate({ ...block, items: [...block.items, ""] })}
          className="flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#4f46e5]"
        ><FiPlus size={12} /> Adicionar item</button>
      </div>
    ));
  }

  if (block.type === "table") {
    return wrap("Tabela", (
      <div className="space-y-2 text-xs">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => {
              const headers = [...block.headers, ""];
              const rows = block.rows.map((r) => [...r, ""]);
              onUpdate({ ...block, headers, rows });
            }}
            className="px-2 py-1 rounded border border-[#e5e7eb] hover:bg-[#f3f4f6] text-[#374151]"
          >+ Coluna</button>
          <button
            onClick={() => {
              if (block.headers.length === 0) return;
              const headers = block.headers.slice(0, -1);
              const rows = block.rows.map((r) => r.slice(0, -1));
              onUpdate({ ...block, headers, rows });
            }}
            className="px-2 py-1 rounded border border-[#e5e7eb] hover:bg-[#f3f4f6] text-[#374151]"
          >- Coluna</button>
          <button
            onClick={() => onUpdate({ ...block, rows: [...block.rows, Array(block.headers.length).fill("")] })}
            className="px-2 py-1 rounded border border-[#e5e7eb] hover:bg-[#f3f4f6] text-[#374151]"
          >+ Linha</button>
          <button
            onClick={() => {
              if (block.rows.length === 0) return;
              onUpdate({ ...block, rows: block.rows.slice(0, -1) });
            }}
            className="px-2 py-1 rounded border border-[#e5e7eb] hover:bg-[#f3f4f6] text-[#374151]"
          >- Linha</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>{block.headers.map((h, i) => (
                <th key={i} className="border border-[#e5e7eb] p-1">
                  <input
                    value={h}
                    onChange={(e) => {
                      const headers = [...block.headers];
                      headers[i] = e.target.value;
                      onUpdate({ ...block, headers });
                    }}
                    className="w-full bg-transparent outline-none font-semibold text-center"
                    placeholder={`Col ${i + 1}`}
                  />
                </th>
              ))}</tr>
            </thead>
            <tbody>{block.rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => (
                <td key={ci} className="border border-[#e5e7eb] p-1">
                  <input
                    value={cell}
                    aria-label={`Linha ${ri + 1}, coluna ${ci + 1}`}
                    onChange={(e) => {
                      const rows = block.rows.map((r, rr) => rr === ri ? r.map((c, cc) => cc === ci ? e.target.value : c) : [...r]);
                      onUpdate({ ...block, rows });
                    }}
                    className="w-full bg-transparent outline-none"
                  />
                </td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
        <input
          type="text"
          value={block.caption ?? ""}
          onChange={(e) => onUpdate({ ...block, caption: e.target.value || undefined })}
          placeholder="Legenda da tabela (opcional)"
          className="w-full border border-[#e5e7eb] rounded px-2 py-1 text-xs text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
        />
      </div>
    ));
  }

  return null;
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: WikiCategory | null;
  onSave: (data: { title: string; description?: string; icon?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "FiBookOpen");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Título obrigatório"); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim() || undefined, icon });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1a3c]/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[#ffffff] shadow-2xl border border-[#e5e7eb]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6]">
          <h2 className="font-bold text-[#0b1a3c]">{initial ? "Editar Categoria" : "Nova Categoria"}</h2>
          <button type="button" onClick={onClose} title="Fechar" className="p-1 rounded hover:bg-[#f3f4f6] text-[#6b7280]"><FiX /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/20"
              placeholder="Nome da categoria"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              placeholder="Descrição opcional"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-2">Ícone</label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setIcon(value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs transition-colors ${
                    icon === value
                      ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                      : "border-[#e5e7eb] hover:bg-[#f9fafb] text-[#6b7280]"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-[#dc2626]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#f3f4f6]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#374151] hover:bg-[#f3f4f6]">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6366f1] text-[#ffffff] hover:bg-[#4f46e5] disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Doc Meta Modal ───────────────────────────────────────────────────────────

function DocMetaModal({
  initial,
  categories,
  onSave,
  onClose,
}: {
  initial?: WikiDoc | null;
  categories: WikiCategory[];
  onSave: (data: { title: string; description?: string; status: DocStatus; categoryId: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<DocStatus>(initial?.status ?? "draft");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Título obrigatório"); return; }
    if (!categoryId) { setError("Selecione uma categoria"); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim() || undefined, status, categoryId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1a3c]/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[#ffffff] shadow-2xl border border-[#e5e7eb]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f3f4f6]">
          <h2 className="font-bold text-[#0b1a3c]">{initial ? "Configurar Doc" : "Novo Documento"}</h2>
          <button type="button" onClick={onClose} title="Fechar" className="p-1 rounded hover:bg-[#f3f4f6] text-[#6b7280]"><FiX /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              placeholder="Nome do documento"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#374151] block mb-1">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              placeholder="Descrição opcional"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-[#374151] block mb-1">Status</label>
              <select
                aria-label="Status do documento"
                value={status}
                onChange={(e) => setStatus(e.target.value as DocStatus)}
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="outdated">Desativado</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-[#374151] block mb-1">Categoria</label>
              <select
                aria-label="Categoria do documento"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm text-[#374151] bg-[#ffffff] outline-none focus:border-[#6366f1]"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-[#6b7280]">
            Rascunho fica visível apenas para você. Publicado avisa todos com acesso ao repositório. Desativado fica oculto para os demais.
          </p>
          {error && <p className="text-xs text-[#dc2626]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#f3f4f6]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#374151] hover:bg-[#f3f4f6]">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6366f1] text-[#ffffff] hover:bg-[#4f46e5] disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  title,
  warning,
  onConfirm,
  onClose,
}: {
  title: string;
  warning?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1a3c]/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#ffffff] shadow-2xl border border-[#e5e7eb]">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-[#ef4444] shrink-0 mt-0.5"><FiAlertTriangle size={20} /></span>
            <div>
              <h2 className="font-bold text-[#0b1a3c]">Deletar {title}</h2>
              {warning && <p className="text-sm text-[#dc2626] mt-1">{warning}</p>}
              <p className="text-sm text-[#6b7280] mt-1">Esta ação não pode ser desfeita.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#374151] hover:bg-[#f3f4f6]">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#ef4444] text-[#ffffff] hover:bg-[#dc2626] disabled:opacity-60"
            >
              {deleting ? "Deletando..." : "Deletar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocsWikiClient({ basePath = "/api/platform-docs" }: { basePath?: string }) {
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [docs, setDocs] = useState<WikiDoc[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar resize
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 480;
  const SIDEBAR_DEFAULT = 256;
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarDragging, setSidebarDragging] = useState(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(SIDEBAR_DEFAULT);
  const desktopSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = desktopSidebarRef.current;
    if (!sidebar) return;
    sidebar.style.setProperty("--docs-sidebar-width", `${sidebarCollapsed ? 40 : sidebarWidth}px`);
  }, [sidebarCollapsed, sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta));
      setSidebarWidth(next);
      if (next <= SIDEBAR_MIN + 20) setSidebarCollapsed(true);
      else setSidebarCollapsed(false);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      setSidebarDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
  }, []);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editBlocks, setEditBlocks] = useState<DocBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Modals
  const [catModal, setCatModal] = useState<{ edit?: WikiCategory } | null>(null);
  const [docMetaModal, setDocMetaModal] = useState<{ edit?: WikiDoc; defaultCategoryId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "category"; item: WikiCategory }
    | { type: "doc"; item: WikiDoc }
    | null
  >(null);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const addBlockRef = useRef<HTMLDivElement>(null);

  // Close add-block dropdown when clicking outside
  useEffect(() => {
    if (!addBlockOpen) return;
    const handler = (e: MouseEvent) => {
      if (addBlockRef.current && !addBlockRef.current.contains(e.target as Node)) {
        setAddBlockOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addBlockOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchApi(basePath);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { categories: WikiCategory[]; docs: WikiDoc[]; canEdit: boolean };
      setCategories(data.categories);
      setDocs(data.docs);
      setCanEdit(data.canEdit);
      // Auto-expand all categories on first load
      setExpandedCategories(new Set(data.categories.map((c) => c.id)));
    } catch {
      setError("Não foi possível carregar a documentação.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null;

  // Enter edit mode
  const startEdit = () => {
    if (!selectedDoc) return;
    setEditBlocks(selectedDoc.blocks.map((b) => ({ ...b })));
    setEditMode(true);
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditBlocks([]);
    setSaveError("");
  };

  const saveEdit = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetchApi(`${basePath}/docs/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: editBlocks }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      const data = await res.json() as { doc: WikiDoc };
      setDocs((prev) => prev.map((d) => d.id === data.doc.id ? data.doc : d));
      setEditMode(false);
      setEditBlocks([]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: DocBlock["type"]) => {
    setAddBlockOpen(false);
    const id = genId();
    let newBlock: DocBlock;
    if (type === "heading") newBlock = { id, type: "heading", level: 2, text: "" };
    else if (type === "paragraph") newBlock = { id, type: "paragraph", text: "" };
    else if (type === "card") newBlock = { id, type: "card", variant: "info", text: "" };
    else if (type === "code") newBlock = { id, type: "code", language: "typescript", code: "" };
    else if (type === "list") newBlock = { id, type: "list", ordered: false, items: [""] };
    else if (type === "divider") newBlock = { id, type: "divider" };
    else newBlock = { id, type: "table", headers: ["Coluna 1", "Coluna 2"], rows: [["", ""]] };
    setEditBlocks((prev) => [...prev, newBlock]);
  };

  const updateBlock = (i: number, b: DocBlock) => {
    setEditBlocks((prev) => prev.map((x, j) => j === i ? b : x));
  };

  const deleteBlock = (i: number) => {
    setEditBlocks((prev) => prev.filter((_, j) => j !== i));
  };

  const moveBlock = (i: number, dir: -1 | 1) => {
    setEditBlocks((prev) => {
      const arr = [...prev];
      const target = i + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[i], arr[target]] = [arr[target], arr[i]];
      return arr;
    });
  };

  // Create category
  const handleCreateCategory = async (data: { title: string; description?: string; icon?: string }) => {
    const res = await fetchApi(`${basePath}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao criar categoria");
    const json = await res.json() as { category: WikiCategory };
    setCategories((prev) => [...prev, json.category].sort((a, b) => a.order - b.order));
    setExpandedCategories((prev) => new Set([...prev, json.category.id]));
  };

  // Edit category
  const handleEditCategory = async (id: string, data: { title: string; description?: string; icon?: string }) => {
    const res = await fetchApi(`${basePath}/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao editar categoria");
    const json = await res.json() as { category: WikiCategory };
    setCategories((prev) => prev.map((c) => c.id === id ? json.category : c));
  };

  // Delete category
  const handleDeleteCategory = async (id: string) => {
    const res = await fetchApi(`${basePath}/categories/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao deletar categoria");
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setDocs((prev) => prev.filter((d) => d.categoryId !== id));
    if (selectedDoc && selectedDoc.categoryId === id) setSelectedDocId(null);
  };

  // Create doc
  const handleCreateDoc = async (data: { title: string; description?: string; status: DocStatus; categoryId: string }) => {
    const res = await fetchApi(`${basePath}/docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao criar documento");
    const json = await res.json() as { doc: WikiDoc };
    setDocs((prev) => [...prev, json.doc].sort((a, b) => a.order - b.order));
    setSelectedDocId(json.doc.id);
    setSidebarOpen(false);
  };

  // Edit doc meta
  const handleEditDocMeta = async (id: string, data: { title: string; description?: string; status: DocStatus; categoryId: string }) => {
    const res = await fetchApi(`${basePath}/docs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao editar documento");
    const json = await res.json() as { doc: WikiDoc };
    setDocs((prev) => prev.map((d) => d.id === id ? json.doc : d));
  };

  // Delete doc
  const handleDeleteDoc = async (id: string) => {
    const res = await fetchApi(`${basePath}/docs/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Erro ao deletar documento");
    setDocs((prev) => prev.filter((d) => d.id !== id));
    if (selectedDocId === id) setSelectedDocId(null);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectDoc = (id: string) => {
    if (editMode) cancelEdit();
    setSelectedDocId(id);
    setSidebarOpen(false);
  };

  // ─── Sidebar ───────────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#f3f4f6] shrink-0">
        <h2 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Repositório</h2>
      </div>
      <nav
        className={`${styles.navScroll} wiki-nav-scroll flex-1 overflow-y-auto py-2 px-2 space-y-1`}
      >
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded bg-[#f3f4f6] animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-xs text-[#9ca3af] p-3">Nenhuma categoria ainda.</p>
        ) : (
          categories.map((cat) => {
            const catDocs = docs.filter((d) => d.categoryId === cat.id).sort((a, b) => a.order - b.order);
            const expanded = expandedCategories.has(cat.id);
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-1 rounded-lg hover:bg-[#f3f4f6] group">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="flex items-center gap-2 flex-1 px-2 py-2 text-left min-w-0"
                  >
                    <span className="shrink-0 text-[#6b7280]">
                      {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </span>
                    <span className="shrink-0 text-[#6366f1]"><CategoryIcon icon={cat.icon} /></span>
                    <span className="text-sm font-semibold text-[#374151] truncate">{cat.title}</span>
                    <span className="text-xs text-[#9ca3af] ml-auto shrink-0">{catDocs.length}</span>
                  </button>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 pr-1 shrink-0">
                      <button
                        onClick={() => setCatModal({ edit: cat })}
                        className="p-1 rounded hover:bg-[#e5e7eb] text-[#9ca3af] hover:text-[#374151]"
                        title="Editar categoria"
                      ><FiEdit2 size={11} /></button>
                      <button
                        onClick={() => setDeleteTarget({ type: "category", item: cat })}
                        className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626]"
                        title="Deletar categoria"
                      ><FiTrash2 size={11} /></button>
                    </div>
                  )}
                </div>
                {expanded && (
                  <div className="ml-5 space-y-0.5 mt-0.5">
                    {catDocs.map((doc) => {
                      const isSelected = doc.id === selectedDocId;
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-1 rounded-lg group ${isSelected ? "bg-[#eef2ff]" : "hover:bg-[#f3f4f6]"}`}
                        >
                          <button
                            onClick={() => selectDoc(doc.id)}
                            className="flex items-center gap-2 flex-1 px-2 py-1.5 text-left min-w-0"
                          >
                            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                              doc.status === "published" ? "bg-[#22c55e]" :
                              doc.status === "outdated" ? "bg-[#94a3b8]" : "bg-[#9ca3af]"
                            }`} />
                            <span className={`text-sm truncate ${isSelected ? "text-[#4f46e5] font-semibold" : "text-[#374151]"}`}>
                              {doc.title}
                            </span>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setDeleteTarget({ type: "doc", item: doc })}
                              className="p-1 rounded hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#dc2626] opacity-0 group-hover:opacity-100 shrink-0 mr-1"
                              title="Deletar doc"
                            ><FiTrash2 size={11} /></button>
                          )}
                        </div>
                      );
                    })}
                    {canEdit && (
                      <button
                        onClick={() => setDocMetaModal({ defaultCategoryId: cat.id })}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-[#9ca3af] hover:text-[#6366f1] hover:bg-[#f3f4f6]"
                      >
                        <FiPlus size={12} />
                        Novo doc
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>
      {canEdit && (
        <div className="p-3 border-t border-[#f3f4f6] shrink-0">
          <button
            onClick={() => setCatModal({})}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[#6366f1] border border-dashed border-[#c7d2fe] hover:bg-[#eef2ff] transition-colors"
          >
            <FiPlus size={14} />
            Nova Categoria
          </button>
        </div>
      )}
    </div>
  );

  // ─── Doc Viewer / Editor ──────────────────────────────────────────────────

  const DocContent = () => {
    if (loading) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <div className="space-y-3 w-full max-w-md">
            <div className="h-8 bg-[#f3f4f6] rounded animate-pulse" />
            <div className="h-4 bg-[#f3f4f6] rounded animate-pulse w-2/3" />
            <div className="h-32 bg-[#f3f4f6] rounded animate-pulse mt-4" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-[#dc2626] font-semibold mb-2">{error}</p>
            <button onClick={load} className="text-sm text-[#6366f1] hover:underline">Tentar novamente</button>
          </div>
        </div>
      );
    }

    if (!selectedDoc) {
      return (
        <div className="flex h-full min-h-0 flex-1 items-center justify-center">
          <div className="text-center text-[#9ca3af] max-w-xs">
            <FiBookOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-[#374151]">Nenhum documento selecionado</p>
            <p className="text-sm mt-1">Escolha um documento na sidebar ou crie um novo.</p>
          </div>
        </div>
      );
    }

    const blocksToRender = editMode ? editBlocks : selectedDoc.blocks;

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {/* Doc Header */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[#f3f4f6]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[selectedDoc.status]}`}>
                  {STATUS_LABEL[selectedDoc.status]}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-[#0b1a3c] leading-tight">{selectedDoc.title}</h1>
              {selectedDoc.description && (
                <p className="mt-1 text-sm text-[#6b7280]">{selectedDoc.description}</p>
              )}
            </div>
            {canEdit && !editMode && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDocMetaModal({ edit: selectedDoc })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                >
                  <FiSettings size={14} /> Configurar
                </button>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#6366f1] text-[#ffffff] hover:bg-[#4f46e5] transition-colors"
                >
                  <FiEdit2 size={14} /> Editar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit toolbar */}
        {editMode && (
          <div className="shrink-0 px-6 py-3 bg-[#fafafa] border-b border-[#e5e7eb] flex items-center gap-2 flex-wrap">
            <div ref={addBlockRef} className="relative">
              <button
                onClick={() => setAddBlockOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#6366f1] text-[#ffffff] hover:bg-[#4f46e5]"
              >
                <FiPlus size={14} /> Adicionar Bloco
                <FiChevronDown size={12} />
              </button>
              {addBlockOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-[#ffffff] shadow-lg z-10 overflow-hidden">
                  {(["heading","paragraph","card","code","list","divider","table"] as DocBlock["type"][]).map((t) => (
                    <button
                      key={t}
                      onClick={() => addBlock(t)}
                      className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6] capitalize"
                    >
                      {t === "heading" ? "Título" : t === "paragraph" ? "Parágrafo" : t === "card" ? "Card" :
                       t === "code" ? "Código" : t === "list" ? "Lista" : t === "divider" ? "Divisor" : "Tabela"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1" />
            {saveError && <span className="text-xs text-[#dc2626]">{saveError}</span>}
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-lg text-sm text-[#374151] border border-[#e5e7eb] hover:bg-[#f3f4f6]"
            >Cancelar</button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#22c55e] text-[#ffffff] hover:bg-[#16a34a] disabled:opacity-60"
            >
              <FiSave size={14} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {blocksToRender.length === 0 && !editMode && (
            <div className="text-center py-16 text-[#9ca3af]">
              <FiFileText size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Este documento ainda não tem conteúdo.</p>
              {canEdit && (
                <button onClick={startEdit} className="mt-2 text-sm text-[#6366f1] hover:underline">Adicionar blocos</button>
              )}
            </div>
          )}
          {editMode ? (
            <div className="space-y-3 max-w-3xl">
              {editBlocks.map((block, i) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onUpdate={(b) => updateBlock(i, b)}
                  onDelete={() => deleteBlock(i)}
                  onMoveUp={() => moveBlock(i, -1)}
                  onMoveDown={() => moveBlock(i, 1)}
                  isFirst={i === 0}
                  isLast={i === editBlocks.length - 1}
                />
              ))}
              {editBlocks.length === 0 && (
                <p className="text-xs text-[#9ca3af] text-center py-6 border border-dashed border-[#e5e7eb] rounded-lg">
                  Clique em "Adicionar Bloco" para começar.
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-3xl">
              {selectedDoc.blocks.map((block) => (
                <BlockViewer key={block.id} block={block} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-full w-full flex-1 self-stretch overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#ffffff] shadow-sm">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        title="Abrir menu"
        className="lg:hidden fixed bottom-4 left-4 z-40 p-3 rounded-full bg-[#6366f1] text-[#ffffff] shadow-lg"
      >
        <FiMenu size={20} />
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-[#0b1a3c]/40" />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#ffffff] border-r border-[#e5e7eb] z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f3f4f6]">
              <span className="font-bold text-[#0b1a3c] text-sm">Documentação</span>
              <button type="button" onClick={() => setSidebarOpen(false)} title="Fechar menu" className="p-1 rounded hover:bg-[#f3f4f6] text-[#6b7280]"><FiX /></button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        ref={desktopSidebarRef}
        className={`${styles.desktopSidebar} ${sidebarDragging ? styles.desktopSidebarDragging : ""} hidden lg:flex flex-col shrink-0 border-r border-[#e5e7eb] bg-[#fafafa] relative`}
      >
        {/* Collapse/expand toggle */}
        <button
          type="button"
          title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          onClick={() => {
            if (sidebarCollapsed) { setSidebarCollapsed(false); setSidebarWidth(SIDEBAR_DEFAULT); }
            else { setSidebarCollapsed(true); }
          }}
          className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#ffffff] border border-[#e5e7eb] shadow-sm text-[#6b7280] hover:text-[#6366f1] hover:border-[#6366f1] transition-colors"
        >
          {sidebarCollapsed ? <FiChevronRight size={12} /> : <FiChevronLeft size={12} />}
        </button>

        {/* Drag handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#6366f1]/30 active:bg-[#6366f1]/50 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            isDragging.current = true;
            setSidebarDragging(true);
            dragStartX.current = e.clientX;
            dragStartWidth.current = sidebarWidth;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />

        {!sidebarCollapsed && <SidebarContent />}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <DocContent />
      </main>

      {/* Modals */}
      {catModal !== null && (
        <CategoryModal
          initial={catModal.edit}
          onSave={catModal.edit
            ? (data) => handleEditCategory(catModal.edit!.id, data)
            : handleCreateCategory
          }
          onClose={() => setCatModal(null)}
        />
      )}

      {docMetaModal !== null && (
        <DocMetaModal
          initial={docMetaModal.edit}
          categories={categories}
          onSave={docMetaModal.edit
            ? (data) => handleEditDocMeta(docMetaModal.edit!.id, data)
            : handleCreateDoc
          }
          onClose={() => setDocMetaModal(null)}
        />
      )}

      {deleteTarget !== null && (
        <DeleteModal
          title={deleteTarget.type === "category" ? `"${deleteTarget.item.title}"` : `"${deleteTarget.item.title}"`}
          warning={deleteTarget.type === "category" ? "Todos os documentos desta categoria também serão deletados." : undefined}
          onConfirm={deleteTarget.type === "category"
            ? () => handleDeleteCategory(deleteTarget.item.id)
            : () => handleDeleteDoc(deleteTarget.item.id)
          }
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
