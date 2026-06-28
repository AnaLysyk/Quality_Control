import type { AccessRequestComparisonRow } from "../../_types/accessRequests.types";

type ChangesShowcaseProps = {
  rows: AccessRequestComparisonRow[];
  selectedFields: string[];
  fieldComments: Record<string, string>;
  readOnly: boolean;
  onToggleField: (field: string) => void;
  onFieldCommentChange: (field: string, value: string) => void;
};

const FORM_SECTIONS = [
  {
    title: "Dados para o cadastro",
    description: "Campos que formarão ou atualizarão o perfil do usuário.",
    fields: ["profileType", "company", "fullName", "username", "email", "phone", "jobRole", "password"],
  },
  {
    title: "Solicitação recebida",
    description: "Título, descrição e observações enviados na solicitação.",
    fields: ["title", "description", "notes"],
  },
] as const;

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
        <span className="whitespace-pre-wrap break-words">{value || "Não informado"}</span>
      </div>
    </div>
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
            {selected ? "Marcado para correção" : row.changed ? "Valor alterado na análise" : "Sem alteração"}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            selected
              ? "border-red-300 bg-red-100 text-red-800"
              : row.changed
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          {selected ? "Ajustar" : row.changed ? "Alterado" : "OK"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <FieldValue label="Recebido" value={row.originalText} tone={selected ? "selected" : "neutral"} />
        <FieldValue label="Vai ficar" value={row.currentText} tone={selected ? "selected" : "neutral"} />
      </div>

      {selected ? (
        <label className="mt-4 block" onClick={(event) => event.stopPropagation()}>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-red-700">Observação de ajuste deste campo</span>
          <input
            type="text"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Ex.: informe a empresa correta para liberar o cadastro"
            className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-950 outline-none focus:border-red-400"
            data-testid={`access-request-adjustment-comment-${row.field}`}
          />
        </label>
      ) : null}
    </article>
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
  const selectedSet = new Set(selectedFields);
  const rowsByField = new Map(rows.map((row) => [row.field, row]));
  const selectedCount = selectedFields.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Formulário da solicitação</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Recebido → como vai ficar</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Clique em um campo para devolver ao solicitante. Campos marcados ficam vermelhos e exigem mensagem no chat.
          </p>
        </div>

        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${selectedCount > 0 ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {selectedCount} campo(s) marcado(s)
        </span>
      </div>

      <div className="grid gap-6 p-5">
        {FORM_SECTIONS.map((section) => {
          const sectionRows = section.fields
            .map((field) => rowsByField.get(field))
            .filter((row): row is AccessRequestComparisonRow => Boolean(row));

          return (
            <div key={section.title}>
              <div className="mb-3">
                <h4 className="text-base font-black text-slate-950">{section.title}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {sectionRows.map((row) => (
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
          );
        })}
      </div>
    </section>
  );
}
