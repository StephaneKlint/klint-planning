"use client";
/**
 * GanttSide — left column (340px) of the Gantt.
 * Renders domain headers + lot rows using absolute positioning
 * so Y positions match exactly the timeline body.
 * Supports drag-to-reorder domains and lots.
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
  /** Called when user drag-reorders lots within a domain */
  onReorderLots?: (domainId: string, orderedLotIds: string[]) => void;
  /** Called when user drag-reorders domains */
  onReorderDomains?: (orderedDomainIds: string[]) => void;
}

interface DragInfo {
  type: "lot" | "domain";
  id: string;
  domainCode: string;
  rowH: number;
  startMouseY: number;
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
  onReorderLots,
  onReorderDomains,
}: GanttSideProps) {
  const { openEdit } = useGanttStore();
  const [addMenuLotId, setAddMenuLotId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // ── Drag-to-reorder state ────────────────────────────────────────────────
  const dragRef = useRef<(DragInfo & { dropSlot: number; currentMouseY: number }) | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropSlot, setDropSlot] = useState(-1);
  const [ghostY, setGhostY] = useState(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const domainsRef = useRef(domains);
  domainsRef.current = domains;

  const getDropIndicatorY = (slot: number): number => {
    if (!dragRef.current || slot < 0) return -1;
    const { type, domainCode } = dragRef.current;
    if (type === "lot") {
      const domLots = rows.filter(r => r.kind === "lot" && r.domainCode === domainCode);
      if (slot === 0) {
        const dr = rows.find(r => r.kind === "domain" && r.domainCode === domainCode);
        return dr ? dr.y + dr.h : 0;
      }
      const prev = domLots[slot - 1];
      return prev ? prev.y + prev.h : 0;
    } else {
      const domRows = rows.filter(r => r.kind === "domain");
      if (slot === 0) return 0;
      const prev = domRows[slot - 1];
      if (!prev) return 0;
      const prevLots = rows.filter(r => r.kind === "lot" && r.domainCode === prev.domainCode);
      return prevLots.length > 0
        ? prevLots[prevLots.length - 1].y + prevLots[prevLots.length - 1].h
        : prev.y + prev.h;
    }
  };

  const startDrag = (info: DragInfo) => {
    dragRef.current = { ...info, dropSlot: -1, currentMouseY: info.startMouseY };
    setGhostY(info.startMouseY - info.rowH / 2);
    setDropSlot(-1);
    setIsDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !innerRef?.current) return;
      dragRef.current.currentMouseY = e.clientY;
      setGhostY(e.clientY - dragRef.current.rowH / 2);

      const innerTop = innerRef.current.getBoundingClientRect().top;
      const relY = e.clientY - innerTop;
      const curRows = rowsRef.current;
      let slot = 0;

      if (dragRef.current.type === "lot") {
        const domLots = curRows.filter(
          r => r.kind === "lot" && r.domainCode === dragRef.current!.domainCode
        );
        for (let i = 0; i < domLots.length; i++) {
          if (relY > domLots[i].y + domLots[i].h / 2) slot = i + 1;
          else break;
        }
      } else {
        const domRows = curRows.filter(r => r.kind === "domain");
        for (let i = 0; i < domRows.length; i++) {
          const domLots = curRows.filter(r => r.kind === "lot" && r.domainCode === domRows[i].domainCode);
          const blockEnd = domLots.length > 0
            ? domLots[domLots.length - 1].y + domLots[domLots.length - 1].h
            : domRows[i].y + domRows[i].h;
          if (relY > (domRows[i].y + blockEnd) / 2) slot = i + 1;
          else break;
        }
      }

      dragRef.current.dropSlot = slot;
      setDropSlot(slot);
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      const { type, id, domainCode, dropSlot: slot } = dragRef.current;
      const curRows = rowsRef.current;
      const curDomains = domainsRef.current;

      if (slot >= 0) {
        if (type === "lot") {
          const domLots = curRows.filter(r => r.kind === "lot" && r.domainCode === domainCode);
          const origIdx = domLots.findIndex(r => r.id === id);
          const without = domLots.filter(r => r.id !== id).map(r => r.id);
          const at = slot > origIdx ? slot - 1 : slot;
          without.splice(Math.max(0, Math.min(at, without.length)), 0, id);
          const domain = curDomains.find(d => d.code === domainCode);
          if (domain && (origIdx !== (slot > origIdx ? slot - 1 : slot))) {
            onReorderLots?.(domain.id, without);
          }
        } else {
          const domRows = curRows.filter(r => r.kind === "domain");
          const origIdx = domRows.findIndex(r => r.id === id);
          const without = domRows.filter(r => r.id !== id).map(r => r.id);
          const at = slot > origIdx ? slot - 1 : slot;
          without.splice(Math.max(0, Math.min(at, without.length)), 0, id);
          if (origIdx !== (slot > origIdx ? slot - 1 : slot)) {
            onReorderDomains?.(without);
          }
        }
      }

      dragRef.current = null;
      setIsDragging(false);
      setDropSlot(-1);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, innerRef, onReorderLots, onReorderDomains]);

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

  const indicatorY = isDragging && dropSlot >= 0 ? getDropIndicatorY(dropSlot) : -1;
  const ghostLabel = isDragging && dragRef.current
    ? (dragRef.current.type === "lot"
        ? lotById[dragRef.current.id]?.name
        : domainById[dragRef.current.id]?.name) ?? ""
    : "";

  return (
    <div
      className={`${styles.side} ${isDragging ? styles.sideIsDragging : ""}`}
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

            {/* Drop indicator line */}
            {indicatorY >= 0 && (
              <div className={styles.dropIndicator} style={{ top: indicatorY }} />
            )}

            {rows.map((row) => {
              if (row.kind === "domain") {
                const domain = domainById[row.id];
                if (!domain) return null;
                const isDraggedDomain = isDragging && dragRef.current?.type === "domain" && dragRef.current.id === row.id;
                return (
                  <div
                    key={`d-${row.id}`}
                    className={`${styles.domainHead} ${isDraggedDomain ? styles.rowDragging : ""}`}
                    style={{
                      position: "absolute",
                      top: row.y,
                      left: 0,
                      right: 0,
                      height: DOMAIN_HEAD_H,
                      background: domain.bg,
                      color: domain.strong,
                    }}
                    onClick={() => !isDragging && openEdit({ kind: "edit-domain", domainId: row.id, planningId })}
                    title="Cliquez pour modifier le domaine"
                  >
                    {/* Grip handle */}
                    <button
                      className={styles.grip}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDrag({ type: "domain", id: row.id, domainCode: row.domainCode, rowH: DOMAIN_HEAD_H, startMouseY: e.clientY });
                      }}
                      aria-label="Réordonner le domaine"
                      title="Glisser pour réordonner"
                    >
                      ⠿
                    </button>
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
              const isDraggedLot = isDragging && dragRef.current?.type === "lot" && dragRef.current.id === row.id;

              return (
                <div
                  key={`l-${row.id}`}
                  className={`${styles.lotRow} ${isDraggedLot ? styles.rowDragging : ""}`}
                  style={{
                    position: "absolute",
                    top: row.y,
                    left: 0,
                    right: 0,
                    height: row.h,
                    cursor: isDragging ? "grabbing" : "pointer",
                  }}
                  onClick={() => !isDragging && openEdit({ kind: "edit-lot", lotId: row.id, planningId })}
                  title="Cliquez pour modifier le projet"
                >
                  {/* Grip handle */}
                  <button
                    className={styles.grip}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startDrag({ type: "lot", id: row.id, domainCode: row.domainCode, rowH: row.h, startMouseY: e.clientY });
                    }}
                    aria-label="Réordonner le projet"
                    title="Glisser pour réordonner"
                  >
                    ⠿
                  </button>
                  <Donut progress={progress} status={status} size={32} />
                  <div className={styles.lotText}>
                    <span className={styles.lotName}>{lot.name}</span>
                    {lot.isPostponed && (
                      <span style={{ display: "inline-block", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", letterSpacing: "0.04em", verticalAlign: "middle", marginLeft: 4 }}>
                        ⏸ REPORTÉ
                      </span>
                    )}
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

      {/* Ghost element — follows cursor during drag */}
      {isDragging && (
        <div
          className={styles.dragGhost}
          style={{ top: ghostY, width }}
        >
          <span className={styles.gripInline}>⠿</span>
          <span className={styles.ghostLabel}>{ghostLabel}</span>
        </div>
      )}
    </div>
  );
}

export default GanttSide;
