import { useState } from "react";
import { FiCheckCircle, FiMessageSquare, FiMoreVertical, FiX } from "react-icons/fi";
import type { AccessRequestComparisonRow } from "../../_types/accessRequests.types";

type ChangesShowcaseProps = {
  rows: AccessRequestComparisonRow[];
  selectedFields: string[];
  fieldComments: Record<string, string>;
  readOnly: boolean;
  submittedAt: string;
  onToggleField: (field: string) => void;
  onFieldCommentChange: (field: string, value: string) => void;
};

const REGISTRATION_FIELDS = ["profileType", "company", "fullName", "username", "email", "phone", "jobRole", "password"] as const;
const COMPANY_FIELDS = ["companyName", "companyTaxId", "companyZip", "companyAddress", "companyPhone", "companyWebsite", "companyLinkedin", "companyDescription", "companyNotes"] as const;
const CONTEXT_FIELDS = ["title", "description", "notes"] as const;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeValue(value: string) {
  return value?.trim() || "";
}

function displayValue(value: string) {
  return safeValue(value) || "NÃ£o informado";
}

function OriginalRequestSection({ rows }: { rows: AccessRequestComparisonRow[] }) {
  const visibleRows = rows.filter((row) => safeValue(row.originalText).length > 0);

  if (visibleRows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700/60 dark:bg-[#0d1b2f]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">SolicitaÃ§Ã£o</p>

      <div className="mt-3 grid gap-4">
        {visibleRows.map((row) => (
          <div key={row.field} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 dark:border-slate-700/60">
            <p className="text-sm font-black text-slate-950 dark:text-slate-50">{row.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {displayValue(row.originalText)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RegistrationFieldRow({
  row,
  selected,
  readOnly,
  comment,
  menuOpen,
  onMenuToggle,
  onToggle,
  onCommentChange,
}: {
  row: AccessRequestComparisonRow;
  selected: boolean;
  readOnly: boolean;
  comment: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onToggle: () => void;
  onCommentChange: (value: string) => void;
}) {
  const hasComment = comment.trim().length > 0;
  const changed = row.changed;

  return (
    <div
      className={classNames(
        "relative rounded-2xl border px-4 py-3 transition",
        selected ? "border-amber-300 bg-amber-50/60 dark:border-amber-400/60 dark:bg-amber-950/30" : "border-slate-200 bg-white dark:border-slate-700/60 dark:bg-[#071426]",
        changed && !selected ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/40 dark:bg-emerald-950/25" : null,
      )}
      data-testid={"access-request-review-field-" + row.field}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(160px,0.32fr)_minmax(0,1fr)_44px] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {changed ? <FiCheckCircle className="h-4 w-4 text-emerald-600" /> : null}
            <p className="truncate text-sm font-black text-slate-950 dark:text-slate-50">{row.label}</p>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {selected ? (hasComment ? "Ajuste orientado" : "Ajuste sem orientaÃ§Ã£o") : changed ? "Alterado apÃ³s ajuste" : "Sem ajuste"}
          </p>
        </div>

        <div className="grid min-w-0 gap-2 md:grid-cols-2">
          <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700/60">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Origem</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{displayValue(row.originalText)}</p>
          </div>

          <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700/60">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Cadastro</p>
            <p className={classNames("mt-1 truncate text-sm font-semibold", changed ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200")}>
              {displayValue(row.currentText)}
            </p>
          </div>
        </div>

        <div className="relative justify-self-end">
          <button
            type="button"
            disabled={readOnly}
            onClick={onMenuToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-[#0d1b2f] dark:text-slate-300 dark:hover:bg-[#13243b]"
            aria-label={"Abrir aÃ§Ãµes de " + row.label}
            title="AÃ§Ãµes"
          >
            <FiMoreVertical />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)] dark:border-slate-700/60 dark:bg-[#0d1b2f]">
              <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#13243b]"
              >
                {selected ? <FiX /> : <FiMessageSquare />}
                {selected ? "Remover ajuste" : "Solicitar ajuste"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-400/40 dark:bg-[#071426]">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
              OrientaÃ§Ã£o ao solicitante
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
              Orientação ao solicitante
            </span>
            <textarea
              value={comment}
              disabled={readOnly}
              rows={3}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Ex.: confirme a empresa correta para seguir com o cadastro."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:bg-white disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700/60 dark:bg-[#020817] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#020817] dark:disabled:bg-[#0d1b2f] dark:disabled:text-slate-400"
              data-testid={"access-request-adjustment-comment-" + row.field}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function ChangesShowcase({
  rows,
  selectedFields,
  fieldComments,
  readOnly,
  onToggleField,
  onFieldCommentChange,
}: ChangesShowcaseProps) {
  const [openMenuField, setOpenMenuField] = useState<string | null>(null);
  const rowsByField = new Map(rows.map((row) => [row.field, row]));
  const selectedSet = new Set(selectedFields);

  const contextRows = CONTEXT_FIELDS.map((field) => rowsByField.get(field)).filter(
    (row): row is AccessRequestComparisonRow => Boolean(row),
  );

  const registrationRows = [...REGISTRATION_FIELDS, ...COMPANY_FIELDS]
    .map((field) => rowsByField.get(field))
    .filter((row): row is AccessRequestComparisonRow => Boolean(row));

  return (
    <div className="grid gap-4">
      <OriginalRequestSection rows={contextRows} />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-[#0d1b2f]">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dados cadastrais</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Campos que formarÃ£o o perfil</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Estes sÃ£o os dados que entram no cadastro. Use os trÃªs pontinhos para solicitar ajuste somente quando necessÃ¡rio.
          </p>
        </div>

        <div className="grid gap-2 p-5">
          {registrationRows.map((row) => (
            <RegistrationFieldRow
              key={row.field}
              row={row}
              selected={row.field !== "password" && selectedSet.has(row.field)}
              readOnly={readOnly || row.field === "password"}
              comment={fieldComments[row.field] ?? ""}
              menuOpen={row.field !== "password" && openMenuField === row.field}
              onMenuToggle={() => { if (row.field === "password") return; setOpenMenuField((current) => (current === row.field ? null : row.field)); }}
              onToggle={() => {
                if (row.field === "password") return;
                onToggleField(row.field);
                setOpenMenuField(null);
              }}
              onCommentChange={(value) => onFieldCommentChange(row.field, value)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

