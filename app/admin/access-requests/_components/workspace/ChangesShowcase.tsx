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

const CADASTRO_FIELDS = ["profileType", "company", "fullName", "username", "email", "phone", "jobRole", "password"] as const;
const CONTEXT_FIELDS = ["title", "description", "notes"] as const;

function formatSubmittedAt(value: string) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao informado";
  return date.toLocaleString("pt-BR");
}

function FieldValue({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "selected";
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div
        className={`mt-1 min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold leading-6 ${
          tone === "selected"
            ? "border-red-200 bg-white text-red-950"
            : "border-slate-200 bg-white text-slate-800"
        }`}
      >
        <span className="whitespace-pre-wrap break-words">{value || "Nao informado"}</span>
      </div>
    </div>
  );
}

function ContextField({ row }: { row: AccessRequestComparisonRow }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-slate-950">{row.label}</h4>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">Contexto recebido, sem ajuste direto.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          Leitura
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <FieldValue label="Recebido" value={row.originalText} />
        {row.changed ? <FieldValue label="Atual na analise" value={row.currentText} /> : null}
      </div>
    </article>
  );
}

function ReviewField({
  row,
  selected,
  readOnly,
  comment,
  onToggle,
  onCommentChange,
}: {
  row: AccessRequestComparisonRow;
  selected: boolean;
  readOnly: boolean;
  comment: string;
  onToggle: () => void;
  onCommentChange: (value: string) => void;
}) {
  const hasComment = comment.trim().length > 0;

  return (
    <article
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      onClick={readOnly ? undefined : onToggle}
      onKeyDown={(event) => {
        if (readOnly) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-red-400 bg-red-50 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${readOnly ? "" : "cursor-pointer"}`}
      aria-pressed={readOnly ? undefined : selected}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className={`text-sm font-black ${selected ? "text-red-900" : "text-slate-950"}`}>{row.label}</h4>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {selected
              ? hasComment
                ? "Campo marcado com orientacao"
                : "Campo marcado, informe a orientacao"
              : row.changed
                ? "Valor alterado na analise"
                : "Pronto para cadastro"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            selected
              ? "border-red-300 bg-red-100 text-red-800"
              : row.changed
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {selected ? "Ajuste" : row.changed ? "Alterado" : "OK"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <FieldValue label="Recebido" value={row.originalText} tone={selected ? "selected" : "neutral"} />
        <FieldValue label="Vai ficar" value={row.currentText} tone={selected ? "selected" : "neutral"} />
      </div>

      {selected ? (
        <label className="mt-4 block" onClick={(event) => event.stopPropagation()}>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-red-700">Observacao que o solicitante recebe</span>
          <input
            type="text"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Ex.: informe a empresa correta para liberar o cadastro"
            className={`mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-red-950 outline-none focus:border-red-400 ${
              hasComment ? "border-red-200" : "border-red-400"
            }`}
            data-testid={`access-request-adjustment-comment-${row.field}`}
          />
          {!hasComment ? (
            <span className="mt-1 block text-xs font-semibold text-red-700">
              Escreva a orientacao deste campo antes de solicitar ajuste.
            </span>
          ) : null}
        </label>
      ) : null}
    </article>
  );
}

function AdjustmentPreview({
  selectedRows,
  fieldComments,
}: {
  selectedRows: AccessRequestComparisonRow[];
  fieldComments: Record<string, string>;
}) {
  if (selectedRows.length === 0) return null;

  return (
    <aside className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">Previa para o solicitante</p>
          <h4 className="mt-1 text-base font-black text-red-950">Campos que voltarao para ajuste</h4>
        </div>
        <span className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-black text-red-800">
          {selectedRows.length} campo(s)
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {selectedRows.map((row) => {
          const note = fieldComments[row.field]?.trim() ?? "";
          return (
            <div key={`adjustment-preview-${row.field}`} className="rounded-xl border border-red-100 bg-white px-3 py-2">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-red-700">{row.label}</p>
              <p className={`mt-1 text-sm font-semibold leading-6 ${note ? "text-slate-800" : "text-red-700"}`}>
                {note || "Observacao pendente para este campo."}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function ChangesShowcase({
  rows,
  selectedFields,
  fieldComments,
  readOnly,
  submittedAt,
  onToggleField,
  onFieldCommentChange,
}: ChangesShowcaseProps) {
  const selectedSet = new Set(selectedFields);
  const rowsByField = new Map(rows.map((row) => [row.field, row]));
  const contextRows = CONTEXT_FIELDS.map((field) => rowsByField.get(field)).filter(
    (row): row is AccessRequestComparisonRow => Boolean(row),
  );
  const registrationRows = CADASTRO_FIELDS.map((field) => rowsByField.get(field)).filter(
    (row): row is AccessRequestComparisonRow => Boolean(row),
  );
  const selectedRows = selectedFields
    .map((field) => rowsByField.get(field))
    .filter((row): row is AccessRequestComparisonRow => Boolean(row));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analise da solicitacao</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Recebido e cadastro final</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Primeiro leia a origem da solicitacao. Depois marque em vermelho apenas os dados de cadastro que precisam voltar ao usuario.
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${selectedRows.length > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {selectedRows.length > 0 ? `${selectedRows.length} campo(s) para ajuste` : "Sem ajuste marcado"}
        </span>
      </div>

      <div className="grid gap-6 p-5">
        <div>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-black text-slate-950">Informacoes enviadas pelo solicitante</h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Contexto original da solicitacao. Nao selecione aqui para ajuste; use os campos de cadastro abaixo.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Origem</p>
              <p className="mt-1 text-xs font-black text-slate-700">Formulario de acesso</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recebida em</p>
              <p className="mt-1 text-xs font-black text-slate-700">{formatSubmittedAt(submittedAt)}</p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {contextRows.map((row) => (
              <ContextField key={`context-field-${row.field}`} row={row} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3">
            <h4 className="text-base font-black text-slate-950">Dados para o cadastro</h4>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Estes sao os campos que formarao o perfil. Clique em um campo para selecionar, marcar em vermelho e escrever a observacao de ajuste.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {registrationRows.map((row) => (
              <ReviewField
                key={`review-field-${row.field}`}
                row={row}
                selected={selectedSet.has(row.field)}
                readOnly={readOnly}
                comment={fieldComments[row.field] ?? ""}
                onToggle={() => onToggleField(row.field)}
                onCommentChange={(value) => onFieldCommentChange(row.field, value)}
              />
            ))}
          </div>
        </div>

        <AdjustmentPreview selectedRows={selectedRows} fieldComments={fieldComments} />
      </div>
    </section>
  );
}
