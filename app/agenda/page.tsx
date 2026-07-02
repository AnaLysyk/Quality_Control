"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheckCircle, FiClock, FiRefreshCw, FiSearch } from "react-icons/fi";
import AccessDeniedState from "@/components/access/AccessDeniedState";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

type ReleaseCalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  releaseName?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  projectSlug?: string | null;
  ownerName?: string | null;
  status?: string | null;
  criticality?: string | null;
  context?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  audienceProfiles?: string[];
  participantNames?: string[];
};

type ReleaseCalendarPayload = {
  events?: ReleaseCalendarEvent[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    planned: "Planejado",
    at_risk: "Em risco",
    blocked: "Bloqueado",
    done: "Concluído",
    cancelled: "Cancelado",
  };

  return labels[status ?? ""] ?? status ?? "Sem status";
}

export default function AgendaPage() {
  const { loading, can } = usePermissionAccess();
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<ReleaseCalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewAgenda = can("release_calendar", "view");

  async function loadEvents() {
    setLoadingEvents(true);
    setError(null);

    try {
      const response = await fetch("/api/release-calendar", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ReleaseCalendarPayload | { error?: string } | null;

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Falha ao carregar agenda");
      }

      setEvents((payload as ReleaseCalendarPayload)?.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar agenda");
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!loading && canViewAgenda) {
      void loadEvents();
    }
  }, [loading, canViewAgenda]);

  const filteredEvents = useMemo(() => {
    const search = normalizeText(query);
    if (!search) return events;

    return events.filter((event) =>
      normalizeText(
        [
          event.title,
          event.description,
          event.releaseName,
          event.companyName,
          event.companySlug,
          event.projectSlug,
          event.ownerName,
          event.status,
          event.criticality,
          event.context,
          ...(event.audienceProfiles ?? []),
          ...(event.participantNames ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(search),
    );
  }, [events, query]);

  const counters = useMemo(() => {
    return {
      total: events.length,
      visible: filteredEvents.length,
      risk: events.filter((event) => event.status === "at_risk").length,
      blocked: events.filter((event) => event.status === "blocked").length,
      done: events.filter((event) => event.status === "done").length,
    };
  }, [events, filteredEvents.length]);

  if (loading) {
    return (
      <main className="release-agenda-page">
        <section className="release-agenda-shell">
          <div className="release-agenda-empty">Validando acesso...</div>
        </section>
      </main>
    );
  }

  if (!canViewAgenda) {
    return (
      <main className="release-agenda-page">
        <section className="release-agenda-shell">
          <AccessDeniedState
            title="Agenda não disponível"
            description="Seu usuário não possui release_calendar:view. Quando essa permissão é removida, a Agenda some do menu e a rota fica bloqueada."
          />
        </section>
      </main>
    );
  }

  return (
    <main className="release-agenda-page">
      <section className="release-agenda-shell">
        <header className="release-agenda-hero">
          <div className="release-agenda-brand">
            <div className="release-agenda-mark">
              <FiCalendar className="h-7 w-7" />
            </div>
            <div>
              <p>Release calendar</p>
              <h1>Agenda</h1>
              <span>Entregas, releases, marcações por empresa, projeto, usuário e suporte.</span>
            </div>
          </div>

          <button type="button" onClick={loadEvents} disabled={loadingEvents}>
            <FiRefreshCw className={loadingEvents ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Atualizar
          </button>
        </header>

        <div className="release-agenda-toolbar">
          <label>
            <FiSearch className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por release, empresa, projeto, responsável, status..."
            />
          </label>

          <div className="release-agenda-counters">
            <span>{counters.visible}/{counters.total} visíveis</span>
            <span>{counters.risk} em risco</span>
            <span>{counters.blocked} bloqueados</span>
            <span>{counters.done} concluídos</span>
          </div>
        </div>

        {error ? <div className="release-agenda-alert">{error}</div> : null}

        <div className="release-agenda-list">
          {filteredEvents.map((event) => (
            <article key={event.id} className="release-agenda-row">
              <div className="release-agenda-date">
                <FiClock className="h-4 w-4" />
                <strong>{formatDateTime(event.startAt)}</strong>
                <small>{formatDateTime(event.endAt)}</small>
              </div>

              <div className="release-agenda-content">
                <div className="release-agenda-title-line">
                  <h2>{event.title}</h2>
                  <span className={"release-agenda-status is-" + (event.status ?? "planned")}>
                    {statusLabel(event.status)}
                  </span>
                </div>

                <p>{event.description || event.releaseName || "Evento de agenda operacional."}</p>

                <div className="release-agenda-meta">
                  <span>{event.companyName || event.companySlug || "Testing Company"}</span>
                  {event.projectSlug ? <span>{event.projectSlug}</span> : null}
                  {event.ownerName ? <span>{event.ownerName}</span> : null}
                  {event.criticality ? <span>{event.criticality}</span> : null}
                </div>
              </div>
            </article>
          ))}

          {!loadingEvents && filteredEvents.length === 0 ? (
            <div className="release-agenda-empty">
              <FiCheckCircle className="h-5 w-5" />
              Nenhum evento encontrado para este filtro.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
