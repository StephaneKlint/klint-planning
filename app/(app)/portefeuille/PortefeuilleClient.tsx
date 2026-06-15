"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioCard } from "@/lib/db/queries";
import styles from "./Portefeuille.module.css";

type FilterKey = "all" | "late" | "at-risk" | "on-track";

const STATUS_CONFIG = {
  "on-track": { label: "Dans les temps", dot: "#16A34A", bg: "#DCFCE7", text: "#15803D" },
  "at-risk":  { label: "À risque",       dot: "#F59E0B", bg: "#FEF3C7", text: "#B45309" },
  "late":     { label: "En retard",      dot: "#DC2626", bg: "#FEE2E2", text: "#B91C1C" },
} as const;

const FILTER_LABELS: Record<FilterKey, string> = {
  all:        "Tous",
  late:       "En retard",
  "at-risk":  "À risque",
  "on-track": "Dans les temps",
};

function fmtDate(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function PortefeuilleClient({ cards }: { cards: PortfolioCard[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts: Record<FilterKey, number> = {
    all:        cards.length,
    late:       cards.filter((c) => c.status === "late").length,
    "at-risk":  cards.filter((c) => c.status === "at-risk").length,
    "on-track": cards.filter((c) => c.status === "on-track").length,
  };

  const visible = filter === "all" ? cards : cards.filter((c) => c.status === filter);

  const globalMilestones = cards
    .flatMap((c) =>
      c.upcomingMilestones.map((m) => ({ ...m, planningName: c.name, planningId: c.id }))
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20);

  return (
    <div className={styles.page}>
      {/* En-tête */}
      <div className={styles.header}>
        <h1 className={styles.title}>Portefeuille</h1>
        <div className={styles.chips}>
          <span className={styles.chip}>
            {cards.length} planning{cards.length !== 1 ? "s" : ""}
          </span>
          {counts.late > 0 && (
            <span className={`${styles.chip} ${styles.chipLate}`}>
              {counts.late} en retard
            </span>
          )}
          {counts["at-risk"] > 0 && (
            <span className={`${styles.chip} ${styles.chipRisk}`}>
              {counts["at-risk"]} à risque
            </span>
          )}
        </div>
      </div>

      {/* Barre de filtres */}
      <div className={styles.filterBar} role="tablist">
        {(["all", "late", "at-risk", "on-track"] as FilterKey[]).map((key) => (
          <button
            key={key}
            className={`${styles.filterBtn} ${filter === key ? styles.filterActive : ""}`}
            onClick={() => setFilter(key)}
            role="tab"
            aria-selected={filter === key}
          >
            {FILTER_LABELS[key]}
            <span className={styles.filterCount}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* Grille de cards */}
      {visible.length === 0 ? (
        <p className={styles.empty}>Aucun planning pour ce filtre.</p>
      ) : (
        <div className={styles.grid}>
          {visible.map((card) => {
            const sc = STATUS_CONFIG[card.status];
            return (
              <article key={card.id} className={styles.card}>
                {/* En-tête de card */}
                <div className={styles.cardHead}>
                  <span className={styles.cardName}>{card.name}</span>
                  <span
                    className={styles.pill}
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    <span className={styles.pillDot} style={{ background: sc.dot }} />
                    {sc.label}
                  </span>
                </div>

                {/* Barre de progression */}
                <div className={styles.progressRow}>
                  <div className={styles.bar}>
                    <div className={styles.fill} style={{ width: `${card.avgProgress}%` }} />
                  </div>
                  <span className={styles.pct}>{card.avgProgress}%</span>
                </div>

                {/* Stats */}
                <div className={styles.stats}>
                  <span>{card.phaseCount} phase{card.phaseCount !== 1 ? "s" : ""}</span>
                  <span className={styles.sep}>·</span>
                  <span>{card.milestoneCount} jalon{card.milestoneCount !== 1 ? "s" : ""}</span>
                  {card.latePhaseCount > 0 && (
                    <>
                      <span className={styles.sep}>·</span>
                      <span className={styles.lateStat}>
                        {card.latePhaseCount} en retard
                      </span>
                    </>
                  )}
                </div>

                {/* Jalons dépassés */}
                {card.overdueMilestones.length > 0 && (
                  <div className={styles.msSection}>
                    <span className={styles.msSectionLabel}>Jalons dépassés</span>
                    {card.overdueMilestones.map((m) => (
                      <div key={m.id} className={styles.msRow}>
                        <span className={styles.msDot} style={{ background: m.color ?? "#DC2626" }} />
                        <span className={styles.msLabel}>{m.label}</span>
                        <span className={styles.msDate} style={{ color: "#DC2626" }}>
                          {fmtDate(m.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Jalons à venir */}
                {card.upcomingMilestones.length > 0 && (
                  <div className={styles.msSection}>
                    <span className={styles.msSectionLabel}>Jalons à venir — 30j</span>
                    {card.upcomingMilestones.map((m) => (
                      <div key={m.id} className={styles.msRow}>
                        <span className={styles.msDot} style={{ background: m.color ?? "#7C3AED" }} />
                        <span className={styles.msLabel}>{m.label}</span>
                        <span className={styles.msDate}>{fmtDate(m.date)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {card.upcomingMilestones.length === 0 && card.overdueMilestones.length === 0 && (
                  <p className={styles.noMs}>Aucun jalon dans les 30 prochains jours</p>
                )}

                {/* Lien */}
                <div className={styles.cardFoot}>
                  <Link href={`/p/${card.id}`} className={styles.openLink}>
                    Ouvrir le planning →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Timeline jalons globale */}
      {globalMilestones.length > 0 && (
        <section className={styles.timeline}>
          <h2 className={styles.timelineTitle}>Tous les jalons — 30 prochains jours</h2>
          <div className={styles.timelineList}>
            {globalMilestones.map((m) => (
              <div key={`${m.planningId}-${m.id}`} className={styles.timelineRow}>
                <span className={styles.tlDate}>{fmtDate(m.date)}</span>
                <span className={styles.tlDot} style={{ background: m.color ?? "#7C3AED" }} />
                <span className={styles.tlLabel}>{m.label}</span>
                <Link href={`/p/${m.planningId}`} className={styles.tlPlanning}>
                  {m.planningName}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
