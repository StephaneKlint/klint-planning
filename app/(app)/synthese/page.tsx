export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { listPlannings, listPlanningsForUser, getGanttData } from "@/lib/db/queries";
import styles from "./Synthese.module.css";
import { SyntheseClient } from "./SyntheseClient";
import type { DomainSummary } from "./SyntheseClient";

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function SynthesePage({ searchParams }: Props) {
  const { planningId: qPlanningId } = await searchParams;

  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const planningList = userId && role !== "admin"
    ? await listPlanningsForUser(userId)
    : await listPlannings();

  if (!planningList.length) {
    return (
      <div className={styles.empty}>
        Aucun planning disponible.
      </div>
    );
  }

  const planningId = qPlanningId ?? planningList[0].id;

  // Vérifier l'accès si planningId vient de l'URL
  if (qPlanningId && role !== "admin" && userId) {
    if (!planningList.find((p) => p.id === planningId)) {
      notFound();
    }
  }

  const data = await getGanttData(planningId);
  if (!data) return <div className={styles.empty}>Données introuvables.</div>;

  const { planning, domains, lots, phases, milestones } = data;

  // --- KPIs ---
  const total = phases.length;
  const counts = {
    planned:     phases.filter((p) => p.status === "planned").length,
    in_progress: phases.filter((p) => p.status === "in_progress").length,
    review:      phases.filter((p) => p.status === "review").length,
    done:        phases.filter((p) => p.status === "done").length,
    risk:        phases.filter((p) => p.status === "risk").length,
    late:        phases.filter((p) => p.status === "late").length,
  };
  const avgProgress =
    total > 0
      ? Math.round(phases.reduce((s, p) => s + p.progress, 0) / total)
      : 0;

  // --- Domain summaries (with lots breakdown) ---
  const domainSummaries: DomainSummary[] = domains.map((domain) => {
    const domLots = lots.filter((l) => l.domainId === domain.id);
    const domPhases = phases.filter((p) => domLots.some((l) => l.id === p.lotId));
    const avg =
      domPhases.length > 0
        ? Math.round(domPhases.reduce((s, p) => s + p.progress, 0) / domPhases.length)
        : 0;

    const lotSummaries = domLots.map((lot) => {
      const lotPhases = phases.filter((p) => p.lotId === lot.id);
      const lotAvg =
        lotPhases.length > 0
          ? Math.round(lotPhases.reduce((s, p) => s + p.progress, 0) / lotPhases.length)
          : 0;
      return {
        id: lot.id,
        name: lot.name,
        subtitle: lot.subtitle ?? null,
        avg: lotAvg,
        phaseCount: lotPhases.length,
        statusCounts: {
          planned:     lotPhases.filter((p) => p.status === "planned").length,
          in_progress: lotPhases.filter((p) => p.status === "in_progress").length,
          done:        lotPhases.filter((p) => p.status === "done").length,
          risk:        lotPhases.filter((p) => p.status === "risk").length,
          late:        lotPhases.filter((p) => p.status === "late").length,
          review:      lotPhases.filter((p) => p.status === "review").length,
        },
      };
    }).filter((l) => l.phaseCount > 0);

    return {
      id: domain.id,
      code: domain.code,
      name: domain.name,
      bg: `var(--d-${domain.code}-bg)`,
      strong: `var(--d-${domain.code}-strong)`,
      phaseColor: `var(--d-${domain.code}-phase)`,
      avg,
      phaseCount: domPhases.length,
      lotCount: domLots.filter((l) => phases.some((p) => p.lotId === l.id)).length,
      lots: lotSummaries,
    };
  }).filter((d) => d.phaseCount > 0);

  // --- Upcoming milestones J+30 / J+60 / J+90 ---
  const todayStr = new Date().toISOString().split("T")[0];
  const in30Str  = new Date(Date.now() +  30 * 86_400_000).toISOString().split("T")[0];
  const in60Str  = new Date(Date.now() +  60 * 86_400_000).toISOString().split("T")[0];
  const in90Str  = new Date(Date.now() +  90 * 86_400_000).toISOString().split("T")[0];

  function enrichMs(list: typeof milestones) {
    return list.map((m) => {
      const lot = lots.find((l) => l.id === m.lotId);
      const domain = lot ? domains.find((d) => d.id === lot.domainId) : null;
      return { m, lot, domain };
    });
  }

  const upcoming30 = enrichMs(milestones.filter((m) => m.date >= todayStr && m.date <= in30Str).sort((a, b) => a.date.localeCompare(b.date)));
  const upcoming60 = enrichMs(milestones.filter((m) => m.date > in30Str  && m.date <= in60Str).sort((a, b) => a.date.localeCompare(b.date)));
  const upcoming90 = enrichMs(milestones.filter((m) => m.date > in60Str  && m.date <= in90Str).sort((a, b) => a.date.localeCompare(b.date)));

  // --- Late / risk phases ---
  const latePhases = phases
    .filter((p) => p.status === "late")
    .map((p) => {
      const lot = lots.find((l) => l.id === p.lotId);
      const domain = lot ? domains.find((d) => d.id === lot.domainId) : null;
      return { p, lot, domain };
    });

  const riskPhases = phases
    .filter((p) => p.status === "risk")
    .map((p) => {
      const lot = lots.find((l) => l.id === p.lotId);
      const domain = lot ? domains.find((d) => d.id === lot.domainId) : null;
      return { p, lot, domain };
    });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Synthèse</h1>
        <span className={styles.subtitle}>{planning.name} · {planning.year}</span>
      </header>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue}>{domains.length}</span>
          <span className={styles.kpiLabel}>Domaines</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue}>{lots.length}</span>
          <span className={styles.kpiLabel}>Projets</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue}>{total}</span>
          <span className={styles.kpiLabel}>Phases</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiProgress}`}>
          <span className={styles.kpiValue}>{avgProgress}%</span>
          <span className={styles.kpiLabel}>Avancement</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiInProgress}`}>
          <span className={styles.kpiValue}>{counts.in_progress}</span>
          <span className={styles.kpiLabel}>En cours</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiDone}`}>
          <span className={styles.kpiValue}>{counts.done}</span>
          <span className={styles.kpiLabel}>Terminées</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiReview}`}>
          <span className={styles.kpiValue}>{counts.review}</span>
          <span className={styles.kpiLabel}>En revue</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiRisk}`}>
          <span className={styles.kpiValue}>{counts.risk}</span>
          <span className={styles.kpiLabel}>À risque</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiLate}`}>
          <span className={styles.kpiValue}>{counts.late}</span>
          <span className={styles.kpiLabel}>En retard</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue}>{upcoming30.length + upcoming60.length + upcoming90.length}</span>
          <span className={styles.kpiLabel}>Jalons 90j</span>
        </div>
      </div>

      {/* Domain progress — interactive (Client Component) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Avancement par domaine</h2>
        <SyntheseClient domainSummaries={domainSummaries} />
      </section>

      <div className={styles.twoCol}>
        {/* Jalons J+30 / J+60 / J+90 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Prochains jalons
          </h2>

          {[
            { label: "J+30", list: upcoming30, color: "#DC2626", bg: "#FEE2E2" },
            { label: "J+60", list: upcoming60, color: "#EA580C", bg: "#FEF3C7" },
            { label: "J+90", list: upcoming90, color: "#15803D", bg: "#DCFCE7" },
          ].map(({ label, list, color, bg }) => (
            <div key={label} className={styles.msGroup}>
              <div className={styles.msGroupHeader} style={{ background: bg, color }}>
                {label}
                <span className={styles.badge} style={{ background: color + "22", color }}>{list.length}</span>
              </div>
              {list.length === 0 ? (
                <p className={styles.emptyGood} style={{ padding: "6px 0" }}>Aucun jalon.</p>
              ) : (
                <ul className={styles.itemList}>
                  {list.map(({ m, lot, domain }) => (
                    <li key={m.id} className={styles.item}>
                      <span className={styles.itemDate}>{fmt(m.date)}</span>
                      <span className={styles.itemDomainChip}
                        style={{
                          background: domain ? `var(--d-${domain.code}-bg)` : "#f1f5f9",
                          color: domain ? `var(--d-${domain.code}-strong)` : "#64748b",
                        }}>
                        {domain?.code.toUpperCase() ?? "—"}
                      </span>
                      <span className={styles.itemLabel}>{m.label}</span>
                      {lot && <span className={styles.itemSub}>{lot.name}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* Late + risk */}
        <div>
          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionLate}`}>
              Phases en retard
              <span className={`${styles.badge} ${styles.badgeLate}`}>{latePhases.length}</span>
            </h2>
            {latePhases.length === 0 ? (
              <p className={styles.emptyGood}>Aucune phase en retard.</p>
            ) : (
              <ul className={styles.itemList}>
                {latePhases.slice(0, 10).map(({ p, lot, domain }) => (
                  <li key={p.id} className={styles.item}>
                    <span className={styles.itemDomainChip}
                      style={{
                        background: domain ? `var(--d-${domain.code}-bg)` : "#f1f5f9",
                        color: domain ? `var(--d-${domain.code}-strong)` : "#64748b",
                      }}>
                      {domain?.code.toUpperCase() ?? "—"}
                    </span>
                    <span className={styles.itemLabel}>{p.label ?? p.type}</span>
                    {lot && <span className={styles.itemSub}>{lot.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionRisk}`}>
              Phases à risque
              <span className={`${styles.badge} ${styles.badgeRisk}`}>{riskPhases.length}</span>
            </h2>
            {riskPhases.length === 0 ? (
              <p className={styles.emptyGood}>Aucune phase à risque.</p>
            ) : (
              <ul className={styles.itemList}>
                {riskPhases.slice(0, 10).map(({ p, lot, domain }) => (
                  <li key={p.id} className={styles.item}>
                    <span className={styles.itemDomainChip}
                      style={{
                        background: domain ? `var(--d-${domain.code}-bg)` : "#f1f5f9",
                        color: domain ? `var(--d-${domain.code}-strong)` : "#64748b",
                      }}>
                      {domain?.code.toUpperCase() ?? "—"}
                    </span>
                    <span className={styles.itemLabel}>{p.label ?? p.type}</span>
                    {lot && <span className={styles.itemSub}>{lot.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
