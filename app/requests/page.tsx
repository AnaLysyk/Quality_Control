"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useCallback } from "react";
import { useSWRRequests } from "./useSWRRequests";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";
import { useI18n } from "@/hooks/useI18n";

type RequestRecord = {
  id: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET" | "PROFILE_DELETION";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  createdAt: string;
  reviewNote?: string;
};

const STATUS_TONE: Record<RequestRecord["status"], "warning" | "positive" | "danger"> = {
  PENDING: "warning",
  APPROVED: "positive",
  REJECTED: "danger",
};

export default function RequestsPage() {
  const router = useRouter();
  const { t, language } = useI18n();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const REQUEST_TYPE_LABEL: Record<RequestRecord["type"], string> = {
    EMAIL_CHANGE: t("requestsPage.typeEmailChange"),
    COMPANY_CHANGE: t("requestsPage.typeCompanyChange"),
    PASSWORD_RESET: t("requestsPage.typePasswordReset"),
    PROFILE_DELETION: t("requestsPage.typeProfileDeletion"),
  };

  const STATUS_LABEL: Record<RequestRecord["status"], string> = {
    PENDING: t("requestsPage.statusPending"),
    APPROVED: t("requestsPage.statusApproved"),
    REJECTED: t("requestsPage.statusRejected"),
  };

  const handleUnauthorized = useCallback(() => {
    const nextMessage = t("requestsPage.expiredSession");
    setMessage(nextMessage);
    toast.error(nextMessage);
    router.push("/login");
  }, [router, t]);

  const { requests, loading, error, refetch, scope } = useSWRRequests();

  const summary = useMemo(() => {
    const pending = requests.filter((item: RequestRecord) => item.status === "PENDING").length;
    const approved = requests.filter((item: RequestRecord) => item.status === "APPROVED").length;
    const rejected = requests.filter((item: RequestRecord) => item.status === "REJECTED").length;
    return { pending, approved, rejected };
  }, [requests]);

  async function submitEmail() {
    setMessage(null);
    const response = await fetch("/api/requests/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: email }),
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nextMessage = payload.message || t("requestsPage.requestError");
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setEmail("");
    setMessage(t("requestsPage.emailSent"));
    toast.success(t("requestsPage.emailSent"));
    void refetch();
  }

  async function submitCompany() {
    setMessage(null);
    const response = await fetch("/api/requests/company-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCompanyName: company }),
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const nextMessage = payload.message || t("requestsPage.requestError");
      setMessage(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setCompany("");
    setMessage(t("requestsPage.companySent"));
    toast.success(t("requestsPage.companySent"));
    void refetch();
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="tc-page-shell py-4 sm:py-6">
        <Breadcrumb items={[{ label: t("requestsPage.account"), href: "/settings/profile" }, { label: t("requestsPage.requests") }]} />

        <section className="tc-hero-panel">
          <div className="tc-hero-grid">
            <div className="space-y-5">
              <div className="tc-hero-copy">
                <p className="tc-hero-kicker">{scope === "all" ? t("requestsPage.centerAll") : t("requestsPage.userRequests")}</p>
                <h1 className="tc-hero-title">{t("requestsPage.title")}</h1>
                <p className="tc-hero-description">
                  {scope === "all"
                    ? t("requestsPage.allDescription")
                    : t("requestsPage.userDescription")}
                </p>
              </div>
            </div>

            <div className="tc-hero-stat-grid">
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">{t("requestsPage.totalRequests")}</div>
                <div className="tc-hero-stat-value">{requests.length}</div>
                <div className="tc-hero-stat-note">{scope === "all" ? t("requestsPage.totalQueue") : t("requestsPage.totalUser")}</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">{t("requestsPage.pending")}</div>
                <div className="tc-hero-stat-value">{summary.pending}</div>
                <div className="tc-hero-stat-note">{t("requestsPage.pendingNote")}</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">{t("requestsPage.approved")}</div>
                <div className="tc-hero-stat-value">{summary.approved}</div>
                <div className="tc-hero-stat-note">{t("requestsPage.approvedNote")}</div>
              </div>
              <div className="tc-hero-stat">
                <div className="tc-hero-stat-label">{t("requestsPage.rejected")}</div>
                <div className="tc-hero-stat-value">{summary.rejected}</div>
                <div className="tc-hero-stat-note">{t("requestsPage.rejectedNote")}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">{t("requestsPage.emailKicker")}</p>
                <h2 className="tc-panel-title">{t("requestsPage.emailTitle")}</h2>
                <p className="tc-panel-description">{t("requestsPage.emailDescription")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{t("requestsPage.newEmail")}</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="novo@email.com"
                  className="form-control-user w-full rounded-xl px-4 py-3 text-sm"
                />
              </label>
              <button type="button" onClick={submitEmail} className="tc-button-primary" disabled={!email.trim()}>
                {t("requestsPage.sendRequest")}
              </button>
            </div>
          </section>

          <section className="tc-panel">
            <div className="tc-panel-header">
              <div>
                <p className="tc-panel-kicker">{t("requestsPage.companyKicker")}</p>
                <h2 className="tc-panel-title">{t("requestsPage.companyTitle")}</h2>
                <p className="tc-panel-description">{t("requestsPage.companyDescription")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex flex-col gap-2 text-sm text-(--tc-text-primary,#0b1a3c)">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#6b7280)">{t("requestsPage.newCompany")}</span>
                <input
                  type="text"
                  autoComplete="organization"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder={t("requestsPage.companyPlaceholder")}
                  className="form-control-user w-full rounded-xl px-4 py-3 text-sm"
                />
              </label>
              <button type="button" onClick={submitCompany} className="tc-button-primary" disabled={!company.trim()}>
                {t("requestsPage.sendRequest")}
              </button>
            </div>
          </section>
        </div>

        {message ? (
          <div className="rounded-[18px] border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm font-medium text-(--tc-text-primary,#0b1a3c)">
            {message}
          </div>
        ) : null}

        <section className="tc-panel">
          <div className="tc-panel-header">
            <div>
              <p className="tc-panel-kicker">{t("requestsPage.historyKicker")}</p>
              <h2 className="tc-panel-title">{t("requestsPage.historyTitle")}</h2>
              <p className="tc-panel-description">{t("requestsPage.historyDescription")}</p>
            </div>
            {loading ? <span className="text-sm font-medium text-(--tc-text-muted,#6b7280)">{t("requestsPage.loading")}</span> : null}
          </div>

          <div className="mt-5 space-y-3">
            {error ? (
              <div className="tc-empty-state">{t("requestsPage.loadError")}</div>
            ) : requests.length === 0 ? (
              <div className="tc-empty-state">{t("requestsPage.empty")}</div>
            ) : (
              requests.map((request) => (
                <article key={request.id} className="tc-panel-muted">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-(--tc-text-primary,#0b1a3c)">{REQUEST_TYPE_LABEL[request.type]}</p>
                      <p className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">{t("requestsPage.createdAt", { date: new Date(request.createdAt).toLocaleString(language === "pt-BR" ? "pt-BR" : "en-US") })}</p>
                      {request.reviewNote ? (
                        <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">{t("requestsPage.note", { note: request.reviewNote })}</p>
                      ) : null}
                    </div>

                    <span className="tc-status-pill" data-tone={STATUS_TONE[request.status]}>
                      <span className="tc-status-dot" />
                      {STATUS_LABEL[request.status]}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
