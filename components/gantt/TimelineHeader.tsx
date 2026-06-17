"use client";
/**
 * TimelineHeader — 2-level timeline header (months row + days/weeks row).
 * Scrolls horizontally in sync with the timeline body.
 */
import type { ZoomLevel } from "./types";
import { buildMonthSegments, buildDayCells, MONTHS_LONG_FR } from "./ganttUtils";
import styles from "./TimelineHeader.module.css";

interface TimelineHeaderProps {
  viewStart: string;
  viewEnd: string;
  ppd: number;
  zoom: ZoomLevel;
  totalW: number;
}

export function TimelineHeader({ viewStart, viewEnd, ppd, zoom, totalW }: TimelineHeaderProps) {
  const months = buildMonthSegments(viewStart, viewEnd, ppd);
  const days = buildDayCells(viewStart, viewEnd, ppd, zoom);

  return (
    <div className={styles.header} style={{ width: totalW }}>
      {/* Row 1 — year pill + months */}
      <div className={styles.monthsRow}>
        {/* Year capsule at far left */}
        <div className={styles.yearPill}>2026</div>
        {months.map((seg, i) => (
          <div
            key={i}
            className={styles.monthCell}
            style={{ position: "absolute", left: seg.x, width: seg.width }}
          >
            {seg.width > 40
              ? seg.width > 80
                ? MONTHS_LONG_FR[seg.month]
                : MONTHS_LONG_FR[seg.month].slice(0, 4)
              : ""}
          </div>
        ))}
      </div>

      {/* Row 2 — weeks or days */}
      <div className={styles.daysRow}>
        {days.map((cell, i) => {
          let displayLabel = "";
          if (zoom === "6m" || zoom === "12m") {
            // Weekly cells — adaptive: full "S25 23/6" or short "S25"
            if (cell.width >= 55) displayLabel = cell.label;
            else if (cell.width >= 26) displayLabel = cell.label.split(" ")[0];
          } else if (zoom === "3m") {
            // Daily cells — week number on Mondays (isMajor), nothing on other days
            if (cell.isMajor) displayLabel = cell.label; // "S25"
          } else {
            // 1m — day numbers (38px cells, always wide enough)
            if (cell.width >= 14) displayLabel = cell.label;
          }
          return (
            <div
              key={i}
              className={`${styles.dayCell} ${cell.isMajor ? styles.dayCellMajor : ""}`}
              style={{
                position: "absolute",
                left: cell.x,
                width: Math.max(cell.width, 1),
                // 3m Monday week labels may overflow into adjacent empty cells
                overflow: zoom === "3m" && cell.isMajor ? "visible" : "hidden",
                zIndex: zoom === "3m" && cell.isMajor ? 1 : undefined,
              }}
            >
              {displayLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TimelineHeader;
