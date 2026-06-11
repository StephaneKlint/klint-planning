export const dynamic = "force-dynamic";

import Link from "next/link";
import { listPlannings, getActivityLog, listConnectionLogs } from "@/lib/db/queries";
import styles from "./Historique.module.css";

const VERB_LABELS: Record<string, string> = {
  status_changed:       "Statut modifié",
  progress_updated:     "Avancement mis à jour",
  moved:                "Déplacé",
  bulk_status_changed:  "Statut modifié (masse)",
  created:              "Créé",
  deleted:              "Supprimé",
  updated:              "Modifié",
};

const TARGET_LABELS: Record<string, string> = {
  phase:     "Phase",
  milestone: "Jalon",
  lot:       "Sous-projet",
  planning:  "Planning",
};

function fmtDatetime(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "";
  const cp1 = code.toUpperCase().charCodeAt(0) - 65 + 0x1F1E6;
  const cp2 = code.toUpperCase().charCodeAt(1) - 65 + 0x1F1E6;
  return String.fromCodePoint(cp1) + String.fromCodePoint(cp2);
}

function truncateUA(ua: string | null, max = 72) {
  if (!ua) return "—";
  return ua.length > max ? ua.slice(0, max) + "…" : ua;
}

interface Props {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function HistoriquePage({ searchParams }: Props) {
  const sp: { tab?: string } = await (searchParams ?? Promise.resolve({}));
  const activeTab = sp.tab === "connexions" ? "connexions" : "activite";

  const planningList = await listPlannings();

  // Load tab-specific data
  const [entries, connLogs] = await Promise.all([
    activeTab === "activite" && planningList.length
      ? getActivityLog(planningList[0].id, 200)
      : Promise.resolve([]),
    activeTab === "connexions"
      ? listConnectionLogs(200)
      : Promise.resolve([]),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Historique</h1>
        {activeTab === "activite" && planningList.length > 0 && (
          <span className={styles.subtitle}>
            {planningList[0].name} · {entries.length} événement{entries.length !== 1 ? "s" : ""}
          </span>
        )}
        {activeTab === "connexions" && (
          <span className={styles.subtitle}>
            {connLogs.length} connexion{connLogs.length !== 1 ? "s" : ""}
          </span>
        )}
      </header>

      {/* Tabs */}
      <nav className={styles.tabs}>
        <Link
          href="/historique?tab=activite"
          className={`${styles.tab} ${activeTab === "activite" ? styles.tabActive : ""}`}
        >
          Activité
        </Link>
        <Link
          href="/historique?tab=connexions"
          className={`${styles.tab} ${activeTab === "connexions" ? styles.tabActive : ""}`}
        >
          Connexions
        </Link>
      </nav>

      {/* ── Activité ── */}
      {activeTab === "activite" && (
        <>
          {!planningList.length ? (
            <div className={styles.emptyState}>
              <p>Aucun planning disponible.</p>
            </div>
          ) : entries.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Aucun événement enregistré pour ce planning.</p>
              <p className={styles.emptyHint}>Les modifications (statuts, dates, notes…) apparaîtront ici.</p>
            </div>
          ) : (
            <div className={styles.timeline}>
              {entries.map((entry) => (
                <div key={entry.id} className={styles.entry}>
                  <div
                    className={styles.avatar}
                    style={{ background: entry.actorColor ?? "#001D63" }}
                    title={entry.actorName ?? "Système"}
                  >
                    {entry.actorInitials ?? "?"}
                  </div>
                  <div className={styles.entryContent}>
                    <div className={styles.entryTop}>
                      <span className={styles.entryVerb}>
                        {VERB_LABELS[entry.verb] ?? entry.verb}
                      </span>
                      {entry.targetType && (
                        <span className={styles.entryTarget}>
                          {TARGET_LABELS[entry.targetType] ?? entry.targetType}
                        </span>
                      )}
                      <span className={styles.entryActor}>
                        {entry.actorName ?? "Système"}
                      </span>
                    </div>
                    <p className={styles.entrySummary}>{entry.summary}</p>
                    <span className={styles.entryDate}>{fmtDatetime(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Connexions ── */}
      {activeTab === "connexions" && (
        <>
          {connLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Aucune connexion enregistrée.</p>
              <p className={styles.emptyHint}>Les connexions sont journalisées à chaque session.</p>
            </div>
          ) : (
            <div className={styles.connTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Adresse IP</th>
                    <th>Pays</th>
                    <th>Ville</th>
                    <th>Navigateur</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {connLogs.map((log) => (
                    <tr key={log.id} className={log.isAlert ? styles.alertRow : ""}>
                      <td className={styles.tdEmail}>{log.email}</td>
                      <td className={styles.tdMono}>{log.ip ?? "—"}</td>
                      <td>
                        <span className={styles.countryCell}>
                          <span className={styles.flag}>{countryFlag(log.countryCode)}</span>
                          <span>{log.country ?? "—"}</span>
                        </span>
                      </td>
                      <td>{log.city ?? "—"}</td>
                      <td className={styles.tdUa} title={log.userAgent ?? ""}>{truncateUA(log.userAgent)}</td>
                      <td className={styles.tdDate}>{fmtDatetime(log.createdAt)}</td>
                      <td>
                        {log.isAlert && (
                          <span className={styles.alertBadge} title="Connexion hors France">⚠ Alerte</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
