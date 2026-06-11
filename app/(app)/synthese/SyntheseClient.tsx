"use client";

import { useState } from "react";
import styles from "./Synthese.module.css";

export interface LotSummary {
  id: string;
  name: string;
  subtitle: string | null;
  avg: number;
  phaseCount: number;
  statusCounts: {
    planned: number;
    in_progress: number;
    done: number;
    risk: number;
    late: number;
    review: number;
  };
}

export interface DomainSummary {
  id: string;
  code: string;
  name: string;
  bg: string;
  strong: string;
  phaseColor: string;
  avg: number;
  phaseCount: number;
  lotCount: number;
  lots: LotSummary[];
}

interface Props {
  domainSummaries: DomainSummary[];
}

const STATUS_CHIPS: {
  key: keyof LotSummary["statusCounts"];
  label: string;
  bg: string;
  color: string;
}[] = [
  { key: "in_progress", label: "En cours", bg: "var(--st-in_progress-bg)", color: "var(--st-in_progress-c)" },
  { key: "done",        label: "Terminé",  bg: "var(--st-done-bg)",        color: "var(--st-done-c)" },
  { key: "risk",        label: "Risque",   bg: "var(--st-risk-bg)",        color: "var(--st-risk-c)" },
  { key: "late",        label: "Retard",   bg: "var(--st-late-bg)",        color: "var(--st-late-c)" },
];

export function SyntheseClient({ domainSummaries }: Props) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    () => new Set(domainSummaries.map((d) => d.id))
  );

  function toggleDomain(id: string) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allExpanded = domainSummaries.every((d) => expandedDomains.has(d.id));
  const allCollapsed = domainSummaries.every((d) => !expandedDomains.has(d.id));

  function expandAll() {
    setExpandedDomains(new Set(domainSummaries.map((d) => d.id)));
  }
  function collapseAll() {
    setExpandedDomains(new Set());
  }

  return (
    <div>
      {/* Tout ouvrir / Tout fermer */}
      {domainSummaries.length > 1 && (
        <div className={styles.expandControls}>
          <button
            className={styles.expandBtn}
            onClick={expandAll}
            disabled={allExpanded}
            aria-label="Tout ouvrir"
          >
            ▼ Tout ouvrir
          </button>
          <button
            className={styles.expandBtn}
            onClick={collapseAll}
            disabled={allCollapsed}
            aria-label="Tout fermer"
          >
            ▶ Tout fermer
          </button>
        </div>
      )}

      <div className={styles.domainList}>
      {domainSummaries.map((domain) => {
        const isOpen = expandedDomains.has(domain.id);
        return (
          <div key={domain.id} className={styles.domainRow}>
            {/* Header row — clickable */}
            <div
              className={styles.domainRowHeader}
              onClick={() => toggleDomain(domain.id)}
              role="button"
              aria-expanded={isOpen}
            >
              <span
                className={styles.domainCode}
                style={{ background: domain.bg, color: domain.strong }}
              >
                {domain.code.toUpperCase()}
              </span>
              <span className={styles.domainName}>{domain.name}</span>
              <span className={styles.domainCount}>
                {domain.lotCount} lot{domain.lotCount > 1 ? "s" : ""} · {domain.phaseCount} phase{domain.phaseCount > 1 ? "s" : ""}
              </span>
              <span
                className={`${styles.domainToggle}${isOpen ? ` ${styles.domainToggleOpen}` : ""}`}
                aria-hidden="true"
              >
                ▶
              </span>
            </div>

            {/* Global progress bar — always visible */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className={styles.progressBar} style={{ flex: 1 }}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${domain.avg}%`, background: domain.phaseColor }}
                />
              </div>
              <span className={styles.progressPct}>{domain.avg}%</span>
            </div>

            {/* Expandable lots block */}
            <div className={`${styles.lotsBlock}${isOpen ? ` ${styles.lotsBlockOpen}` : ""}`}>
              {domain.lots.map((lot) => (
                <div key={lot.id} className={styles.lotItem}>
                  <div className={styles.lotInfo}>
                    <span className={styles.lotName}>{lot.name}</span>
                    {lot.subtitle && (
                      <span className={styles.lotSubtitle}>{lot.subtitle}</span>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  <div className={styles.lotProgress}>
                    <div
                      className={styles.lotProgressFill}
                      style={{ width: `${lot.avg}%`, background: domain.phaseColor }}
                    />
                  </div>
                  <span className={styles.lotPct}>{lot.avg}%</span>

                  {/* Status chips */}
                  <div className={styles.lotStatusChips}>
                    {STATUS_CHIPS.filter((s) => lot.statusCounts[s.key] > 0).map((s) => (
                      <span
                        key={s.key}
                        className={styles.lotStatusChip}
                        style={{ background: s.bg, color: s.color }}
                        title={s.label}
                      >
                        {s.label} {lot.statusCounts[s.key]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
