"use client";
/**
 * GanttSide — left column (340px) of the Gantt.
 * Renders domain headers + lot rows using absolute positioning
 * so Y positions match exactly the timeline body.
 */
import type { RowEntry } from "./types";
import type { DomainRow, LotRow } from "@/lib/db/queries";
import { Donut } from "@/components/ui/Donut";
import type { StatusCode } from "@/components/ui/StatusPill";
import styles from "./GanttSide.module.css";

interface GanttSideProps {
  rows: RowEntry[];
  totalH: number;
  domains: DomainRow[];
  lots: LotRow[];
  /** average progress per lot: lotId → 0..100 */
  lotProgress: Record<string, number>;
  /** effective status per lot: lotId → StatusCode */
  lotStatus: Record<string, StatusCode>;
  width?: number;
  /** ref forwarded to the scrollable rows container for JS scroll sync */
  rowsRef?: React.RefObject<HTMLDivElement | null>;
}

const DOMAIN_HEAD_H = 36;

export function GanttSide({
  rows,
  totalH,
  domains,
  lots,
  lotProgress,
  lotStatus,
  width = 340,
  rowsRef,
}: GanttSideProps) {
  const domainById = Object.fromEntries(domains.map((d) => [d.id, d]));
  const lotById = Object.fromEntries(lots.map((l) => [l.id, l]));

  return (
    <div
      className={styles.side}
      style={{ width, minWidth: width }}
      aria-label="Panneau des projets"
    >
      {/* Fixed header above rows */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>Nom</span>
        <span className={styles.headerCount}>{lots.length} lots</span>
      </div>

      {/* Scrollable rows — height matches timeline body, scrollTop synced via Gantt.tsx */}
      <div className={styles.rowsOuter} ref={rowsRef}>
        <div style={{ position: "relative", height: totalH }}>
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
                  }}
                >
                  <span className={styles.domainName}>{domain.name}</span>
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
                }}
              >
                <Donut progress={progress} status={status} size={32} />
                <div className={styles.lotText}>
                  <span className={styles.lotName}>{lot.name}</span>
                  {lot.subtitle && (
                    <span className={styles.lotSubtitle}>{lot.subtitle}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GanttSide;
