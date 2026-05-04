export default function RunPageLoading() {
  return (
    <div className="w-full py-6 sm:py-8 text-(--tc-text,#0b1a3c) animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header card skeleton */}
        <div className="overflow-hidden rounded-4xl bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] p-6 sm:p-8 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="h-3 w-12 rounded-full bg-white/20" />
              <div className="h-9 w-64 rounded-xl bg-white/20" />
              <div className="h-4 w-40 rounded-full bg-white/10" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-24 rounded-full bg-white/15" />
              ))}
            </div>
          </div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl px-4 py-4 flex items-center justify-between border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff)"
            >
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded-full bg-slate-200" />
                <div className="h-4 w-14 rounded-full bg-slate-200" />
              </div>
              <div className="h-9 w-14 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>

        {/* PDF summary skeleton */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[210mm] min-h-64 rounded-2xl border border-slate-200 bg-white p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-16 rounded-full bg-slate-200" />
                <div className="h-6 w-40 rounded-xl bg-slate-200" />
              </div>
            </div>
            <div className="flex justify-center">
              <div className="h-40 w-40 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Kanban skeleton */}
        <div className="rounded-2xl border border-(--tc-border)/30 bg-(--tc-primary)/4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 w-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl p-5 border border-slate-200 bg-slate-50 min-h-40 space-y-3">
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-full rounded-full bg-slate-100" />
                <div className="h-4 w-3/4 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
