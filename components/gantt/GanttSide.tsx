"use client";
/**
 * GanttSide — left column (340px) of the Gantt.
 * Renders domain headers + lot rows using absolute positioning
 * so Y positions match exactly the timeline body.
 * Empty state shown when planning has no domains yet.
 */
import { useState, useEffect, useRef } from "react";
import type { RowEntry } from "./types";
import type { DomainRow, LotRow } from "@/lib/db/queries";
import { Donut } from "@/components/ui/Donut";
import type { StatusCode } from "@/components/ui/StatusPill";
import { useGanttStore } from "@/store/ganttStore";
import styles from "./GanttSide.module.css";

interface GanttSideProps {
  rows: RowEntry[];
  totalH: number;
  domains: DomainRow[];
  lots: LotRow[];
  planningId: string;
  /** average progress per lot: lotId → 0..100 */
  lotProgress: Record<string, number>;
  /** effective status per lot: lotId → StatusCode */
  lotStatus: Record<string, StatusCode>;
  width?: number;
  /** ref forwarded to the inner rows div for CSS-transform scroll sync */
  innerRef?: React.RefObject<HTMLDivElement | null>;
  /** Called when user clicks "mark all phases done" on a lot */
  onMarkLotDone?: (lotId: string) => void;
}

const DOMAIN_HEAD_H = 36;

export function GanttSide({
  rows,
  totalH,
  domains,
  lots,
  planningId,
  lotProgress,
  lotStatus,
  width = 340,
  innerRef,
  onMarkLotDone,
}: GanttSideProps) {
  const { openEdit } = useGanttStore();
  // Mini-menu state: which lot's + menu is open
  const [addMenuLotId, setAddMenuLotId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Close add menu on outside click
  useEffect(() => {
    if (!addMenuLotId) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuLotId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addMenuLotId]);
  const domainById = Object.fromEntries(domains.map((d) => [d.id, d]));
  const lotById = Object.fromEntries(lots.map((l) => [l.id, l]));
  const isEmpty = domains.length === 0;

  return (
    <div
      className={styles.side}
      style={{ width, minWidth: width }}
      aria-label="Panneau des projets"
    >
      {/* Fixed header above rows */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>Nom</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!isEmpty && (
            <span className={styles.headerCount}>{lots.length} lot{lots.length > 1 ? "s" : ""}</span>
          )}
          <button
            className={styles.addDomainBtn}
            onClick={() => openEdit({ kind: "create-domain", planningId })}
            title="Ajouter un domaine"
            aria-label="Ajouter un domaine"
          >
            + Domaine
          </button>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗂️</div>
          <p className={styles.emptyTitle}>Planning vide</p>
          <p className={styles.emptyDesc}>
            Commencez par créer un <strong>domaine</strong>, puis ajoutez des projets (lots) et des phases.
          </p>
          <button
            className={styles.emptyAction}
            onClick={() => openEdit({ kind: "create-domain", planningId })}
          >
            + Créer un domaine
          </button>
          <p className={styles.emptyHint}>
            Ou importez un planning JSON depuis la liste des plannings
          </p>
        </div>
      ) : (
        /* Rows container — transform synced by Gantt.tsx via innerRef */
        <div className={styles.rowsOuter} data-gantt-side-rows="true">
          <div ref={innerRef} data-gantt-side-inner="true" style={{ position: "relative", height: totalH }}>
            {rows.map((row) => {
              if (row.kind === "domain") {
                const domain = domainById[row.id];
                if (!domain) return null;
                return (
                  <div
                    key={`d-${row.id}`}
                    className={styles.domainHead}
                    style={{
                      position: "absolute",
                      top: row.y,
                      left: 0,
                      right: 0,
                      height: DOMAIN_HEAD_H,
                      background: domain.bg,
                      color: domain.strong,
                      cursor: "pointer",
                    }}
                    onClick={() => openEdit({ kind: "edit-domain", domainId: row.id, planningId })}
                    title="Cliquez pour modifier le domaine"
                  >
                    <span className={styles.domainName}>{domain.name}</span>
                    <button
                      className={styles.addBtn}
                      onClick={(e) => { e.stopPropagation(); openEdit({ kind: "create-lot", domainId: row.id }); }}
                      title="Ajouter un projet dans ce domaine"
                      aria-label="Ajouter un projet"
                      style={{ color: domain.strong, borderColor: domain.strong + "44" }}
                    >
                      +
                    </button>
                  </div>
                );
              }

              // kind === "lot"
              const lot = lotById[row.id];
              if (!lot) return null;
              const progress = lotProgress[lot.id] ?? 0;
              const status: StatusCode = lotStatus[lot.id] ?? "planned";

              return (
                <div
                  key={`l-${row.id}`}
                  className={styles.lotRow}
                  style={{
                    position: "absolute",
                    top: row.y,
                    left: 0,
                    right: 0,
                    height: row.h,
                    cursor: "pointer",
                  }}
                  onClick={() => openEdit({ kind: "edit-lot", lotId: row.id, planningId })}
                  title="Cliquez pour modifier le projet"
                >
                  <Donut progress={progress} status={status} size={32} />
                  <div className={styles.lotText}>
                    <span className={styles.lotName}>{lot.name}</span>
                    {lot.subtitle && (
                      <span className={styles.lotSubtitle}>{lot.subtitle}</span>
                    )}
                  </div>
                  {/* ✓ Tout à 100% */}
                  {onMarkLotDone && (
                    <button
                      className={styles.doneBtn}
                      onClick={(e) => { e.stopPropagation(); onMarkLotDone(row.id); }}
                      title="Marquer toutes les phases à 100% (annulable)"
                      aria-label="Tout marquer comme terminé"
                    >
                      ✓
                    </button>
                  )}

                  {/* + menu — Phase ou Jalon */}
                  <div
                    ref={addMenuLotId === row.id ? addMenuRef : undefined}
                    style={{ position: "relative" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={styles.addPhaseBtn}
                      onClick={() => setAddMenuLotId(addMenuLotId === row.id ? null : row.id)}
                      title="Ajouter une phase ou un jalon"
                      aria-label="Ajouter"
                      aria-expanded={addMenuLotId === row.id}
                    >
                      +
                    </button>
                    {addMenuLotId === row.id && (
                      <div className={styles.addMenu}>
                        <button
                          className={styles.addMenuItem}
                          onClick={() => { setAddMenuLotId(null); openEdit({ kind: "create-phase", lotId: row.id }); }}
                        >
                          <span className={styles.addMenuIcon}>▬</span>
                          Phase
                        </button>
                        <button
                          className={styles.addMenuItem}
                          onClick={() => { setAddMenuLotId(null); openEdit({ kind: "create-milestone", lotId: row.id }); }}
                        >
                          <span className={styles.addMenuIcon}>◆</span>
                          Jalon
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default GanttSide;
