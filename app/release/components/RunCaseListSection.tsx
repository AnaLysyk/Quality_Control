"use client";

import { useState, useEffect } from "react";
import {
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiExternalLink,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";
import type { RunDetailViewModel } from "@/lib/runDetailViewModel";
import { RunKanbanStream } from "../RunKanbanStream";
import type { ReleaseEntry } from "../data";
import styles from "./RunCaseListSection.module.css";

type CaseItem = {
  id: string;
  title?: string;
  status?: string;
  origin?: string | null;
  type?: string | null;
  description?: string | null;
  stepsText?: string | null;
  expectedText?: string | null;
  priority?: string | null;
  severity?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  bug?: string | null;
  link?: string | null;
};

type StatusKey = "pass" | "fail" | "blocked" | "not_run";

const STATUS_META: Record<StatusKey, { label: string; rowClass: string; badgeClass: string }> = {
  pass:    { label: "Passou",        rowClass: styles.rowPass,    badgeClass: styles.badgePass },
  fail:    { label: "Falhou",        rowClass: styles.rowFail,    badgeClass: styles.badgeFail },
  blocked: { label: "Bloqueado",     rowClass: styles.rowBlocked, badgeClass: styles.badgeBlocked },
  not_run: { label: "NÃ£o Executado", rowClass: styles.rowNotRun,  badgeClass: styles.badgeNotRun },
};

const STATUS_ORDER: StatusKey[] = ["fail", "blocked", "not_run", "pass"];

function normalizeStatus(raw?: string): StatusKey {
  if (!raw) return "not_run";
  const v = raw.toLowerCase().replace(/[-\s]/g, "_");
  if (v === "pass" || v === "passed") return "pass";
  if (v === "fail" || v === "failed") return "fail";
  if (v === "blocked") return "blocked";
  return "not_run";
}

function formatDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function CaseRow({ item }: { item: CaseItem }) {
  const [open, setOpen] = useState(false);
  const sk = normalizeStatus(item.status);
  const meta = STATUS_META[sk];
  const dur = formatDuration(item.startedAt, item.finishedAt);
  const hasDetails =
    item.description || item.stepsText || item.expectedText || item.bug || item.link;

  return (
    <div className={`${styles.row} ${meta.rowClass}`}>
      <button
        className={styles.rowHeader}
        onClick={() => hasDetails && setOpen((o) => !o)}
        aria-expanded={hasDetails ? open : undefined}
        data-clickable={hasDetails ? "true" : undefined}
      >
        <span className={styles.rowChevron} aria-hidden>
          {hasDetails ? (
            open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />
          ) : (
            <span className={styles.rowChevronPlaceholder} />
          )}
        </span>

        <span className={styles.rowTitle}>{item.title ?? `Caso #${item.id}`}</span>

        <span className={styles.rowMeta}>
          {item.priority && (
            <span className={styles.metaPill}>{item.priority}</span>
          )}
          {dur && (
            <span className={styles.metaDuration}>
              <FiClock size={11} />
              {dur}
            </span>
          )}
        </span>

        <span className={`${styles.badge} ${meta.badgeClass}`}>{meta.label}</span>
      </button>

      {open && hasDetails && (
        <div className={styles.rowBody}>
          {(item.type || item.origin || item.priority || item.severity) && (
            <div className={styles.detailMeta}>
              {item.type && <span>Tipo: <strong>{item.type}</strong></span>}
              {item.origin && <span>Origem: <strong>{item.origin}</strong></span>}
              {item.priority && <span>Prioridade: <strong>{item.priority}</strong></span>}
              {item.severity && <span>Severidade: <strong>{item.severity}</strong></span>}
            </div>
          )}

          {item.description && (
            <div className={styles.detailBlock}>
              <p className={styles.detailLabel}>DescriÃ§Ã£o</p>
              <p className={styles.detailText}>{item.description}</p>
            </div>
          )}

          {item.stepsText && (
            <div className={styles.detailBlock}>
              <p className={styles.detailLabel}>Passos</p>
              <p className={styles.detailText}>{item.stepsText}</p>
            </div>
          )}

          {item.expectedText && (
            <div className={styles.detailBlock}>
              <p className={styles.detailLabel}>Resultado Esperado</p>
              <p className={styles.detailText}>{item.expectedText}</p>
            </div>
          )}

          {(item.bug || item.link) && (
            <div className={styles.detailLinks}>
              {item.bug && (
                <a
                  href={item.bug}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkBug}
                >
                  <FiExternalLink size={12} />
                  Defeito vinculado
                </a>
              )}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkCase}
                >
                  <FiExternalLink size={12} />
                  Abrir no RepositÃ³rio
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusGroupHeader({
  sk,
  count,
}: {
  sk: StatusKey;
  count: number;
}) {
  return (
    <h3 className={`${styles.groupHeader} ${styles[`groupHeader_${sk}`]}`}>
      <span className={`${styles.groupDot} ${styles[`groupDot_${sk}`]}`} />
      {STATUS_META[sk].label}
      <span className={styles.groupCount}>{count}</span>
    </h3>
  );
}

function ManualCaseList({ runSlug }: { runSlug: string }) {
  const [items, setItems] = useState<CaseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi(`/api/releases-manual/${runSlug}/cases`)
      .then((res) => res.json())
      .then((data: unknown) =>
        setItems(Array.isArray(data) ? (data as CaseItem[]) : [])
      )
      .catch(() => setError("Erro ao carregar casos da execuÃ§Ã£o."));
  }, [runSlug]);

  if (error) {
    return <p className={`${styles.stateMsg} ${styles.stateMsgError}`}>{error}</p>;
  }
  if (!items) {
    return <p className={styles.stateMsg}>Carregando casosâ€¦</p>;
  }
  if (!items.length) {
    return (
      <p className={styles.stateMsg}>
        Nenhum caso registrado nesta execuÃ§Ã£o ainda.
      </p>
    );
  }

  const groups: Record<StatusKey, CaseItem[]> = {
    pass: [],
    fail: [],
    blocked: [],
    not_run: [],
  };
  for (const item of items) {
    groups[normalizeStatus(item.status)].push(item);
  }

  return (
    <div className={styles.listRoot}>
      {STATUS_ORDER.map((sk) => {
        const group = groups[sk];
        if (!group.length) return null;
        return (
          <section key={sk} className={styles.group}>
            <StatusGroupHeader sk={sk} count={group.length} />
            {group.map((item) => (
              <CaseRow key={item.id} item={item} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function RunCaseListSection({ vm }: { vm: RunDetailViewModel }) {
  const companySlug = vm.companySlug !== "demo" ? vm.companySlug : undefined;

  return (
    <section
      data-testid="test-run-linked-case"
      className={styles.sectionCard}
    >
      <h2 className={styles.sectionTitle}>Casos de Teste</h2>

      {vm.source === "API" ? (
        /* Qase API runs â€” keep existing streaming component */
        <RunKanbanStream
          projectKey={vm.projectKey}
          projectCode={vm.projectCode}
          runId={(vm.releaseData as ReleaseEntry).runId ?? 0}
          companySlug={companySlug}
          persistEndpoint={vm.apiPersistEndpoint}
          editable={false}
          allowStatusChange={false}
          allowLinkEdit={vm.canPersistApiLinks}
        />
      ) : (
        <ManualCaseList runSlug={vm.releaseData.slug} />
      )}
    </section>
  );
}

