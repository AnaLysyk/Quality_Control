import Image from "next/image";
import { FiSend } from "react-icons/fi";
import type { AccessRequestCommentView } from "../../_types/accessRequests.types";
import { safeDate } from "./workspace.helpers";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function authorLabel(comment: AccessRequestCommentView) {
  return comment.authorRole === "leader_tc" ? "Revisor" : "Solicitante";
}

function TestingCompanySpinner({ size = 28 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-xl bg-linear-to-r from-[#011848] to-[#ef0001] shadow-sm" style={{ width: size + 12, height: size + 12 }}>
      <span className="relative block" style={{ width: size, height: size }}>
        <Image
          src="/images/tc.png"
          alt="Testing Company"
          fill
          sizes={`${size}px`}
          className="animate-spin-slower pointer-events-none select-none object-contain object-center motion-reduce:animate-none"
        />
      </span>
    </span>
  );
}

export function ConversationPanel({
  comments,
  loading,
  error,
  locked,
  value,
  sending,
  onChange,
  onSend,
}: {
  comments: AccessRequestCommentView[];
  loading: boolean;
  error: string | null;
  locked: boolean;
  value: string;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-[#0d1b2f]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3.5 dark:border-slate-700/60 dark:bg-[#0d1b2f]">
        <div className="flex min-w-0 items-center gap-3">
          <TestingCompanySpinner size={24} />

          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950 dark:text-slate-50">conversa-com-solicitante</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {comments.length > 0
                ? `${comments.length} mensagem(ns) registrada(s)`
                : "Nenhuma conversa iniciada"}
            </p>
          </div>
        </div>

        {loading ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            Carregando...
          </span>
        ) : null}
      </div>

      <div className="bg-white px-4 py-3 dark:bg-[#0d1b2f]">
        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-400/40 dark:bg-rose-950/35 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="max-h-56 space-y-1 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 text-center dark:border-slate-700/60 dark:bg-[#071426]">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">Nenhuma conversa ainda</p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Escreva abaixo para iniciar o contato com o solicitante.
                </p>
              </div>
            </div>
          ) : (
            comments.map((comment) => {
              const mine = comment.authorRole === "leader_tc";

              return (
                <article
                  key={comment.id}
                  className="group flex gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 dark:hover:bg-[#13243b]"
                >
                  <span
                    className={classNames(
                      "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black shadow-sm",
                      mine ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950" : "bg-slate-100 text-slate-700 dark:bg-[#13243b] dark:text-slate-200",
                    )}
                  >
                    {initials(comment.authorName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-black text-slate-950 dark:text-slate-50">
                        {authorLabel(comment)}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {comment.authorName}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {safeDate(comment.createdAt)}
                      </p>
                    </div>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-800 dark:text-slate-200">
                      {comment.body}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {!locked ? (
          <div className="mt-3 rounded-xl border border-slate-300 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)] focus-within:border-slate-500 dark:border-slate-700/60 dark:bg-[#071426] dark:focus-within:border-slate-500">
            <textarea
              className="min-h-12 w-full resize-none border-0 bg-transparent px-3 py-2 text-sm font-medium leading-6 text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              rows={2}
              placeholder="Enviar mensagem para o solicitante..."
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />

            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Mensagem livre. Não altera o status da solicitação.
              </p>

              <button
                type="button"
                onClick={onSend}
                disabled={sending || value.trim().length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-sky-700 dark:hover:bg-sky-600"
              >
                <FiSend className="h-3.5 w-3.5" />
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:border-slate-700/60 dark:bg-[#071426] dark:text-slate-400">
            Conversa bloqueada porque a solicitação foi finalizada.
          </div>
        )}
      </div>
    </section>
  );
}


