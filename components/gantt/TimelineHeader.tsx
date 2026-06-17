"use client";
/**
 * TimelineHeader — 3-row timeline header: Mois / Semaine / Jour.
 * Year is embedded in month label for the first visible cell and every January.
 * Uses MONTHS_FR for short labels (handles Juin/Juil distinction correctly).
 */
import type { ZoomLevel } from "./types";
import { buildMonthSegments, buildWeekCells, buildDayCells, MONTHS_LONG_FR, MONTHS_FR } from "./ganttUtils";
import styles from "./TimelineHeader.module.css";

interface TimelineHeaderProps {
  viewStart: string;
  viewEnd: string;
  ppd: number;
  zoom: ZoomLevel;
  totalW: number;
}

function weekLabel(weekNum: number, width: number): string {
  if (width >= 90) return `Semaine ${weekNum}`;
  if (width >= 48) return `Sem. ${weekNum}`;
  if (width >= 18) return `S${weekNum}`;
  return "";
}

/** Returns the label for a month cell.
 *  isYearAnchor = first visible cell OR January → embed the year.
 *  Uses MONTHS_FR for short form to keep Juin/Juil unambiguous.
 */
function monthLabel(
  month: number, year: number, width: number, isYearAnchor: boolean
): string {
  const yy = String(year).slice(2); // "26"
  if (isYearAnchor) {
    if (width >= 90)  return `${MONTHS_LONG_FR[month]} ${year}`;   // "Janvier 2026"
    if (width >= 58)  return `${MONTHS_FR[month]} ${year}`;        // "Jan 2026"
    if (width >= 42)  return `${MONTHS_FR[month]} '${yy}`;         // "Jan '26"
    if (width >= 28)  return `'${yy}`;                             // "'26"
    return "";
  }
  if (width >= 80) return MONTHS_LONG_FR[month];  // "Janvier"
  if (width >= 32) return MONTHS_FR[month];       // "Jan"
  return "";
}

export function TimelineHeader({ viewStart, viewEnd, ppd, zoom, totalW }: TimelineHeaderProps) {
  const months = buildMonthSegments(viewStart, viewEnd, ppd);
  const weeks  = buildWeekCells(viewStart, viewEnd, ppd);
  const days   = buildDayCells(viewStart, viewEnd, ppd, zoom);

  return (
    <div className={styles.header} style={{ width: totalW }}>
      {/* Row 1 — months (year embedded in first cell + every January) */}
      <div className={styles.monthsRow}>
        {months.map((seg, i) => {
          const isYearAnchor = i === 0 || seg.month === 0;
          const isNewYear = seg.month === 0 && i > 0; // January after first cell
          return (
            <div
              key={i}
              className={`${styles.monthCell} ${isNewYear ? styles.monthCellNewYear : ""}`}
              style={{ position: "absolute", left: seg.x, width: seg.width }}
            >
              {monthLabel(seg.month, seg.year, seg.width, isYearAnchor)}
            </div>
          );
        })}
      </div>

      {/* Row 2 — week numbers */}
      <div className={styles.weeksRow}>
        {weeks.map((cell, i) => (
          <div
            key={i}
            className={styles.weekCell}
            style={{ position: "absolute", left: cell.x, width: Math.max(cell.width, 1) }}
          >
            {weekLabel(cell.weekNum, cell.width)}
          </div>
        ))}
      </div>

      {/* Row 3 — day numbers (Monday date for 6m/12m) */}
      <div className={styles.daysRow}>
        {days.map((cell, i) => (
          <div
            key={i}
            className={`${styles.dayCell} ${cell.isMajor ? styles.dayCellMajor : ""}`}
            style={{ position: "absolute", left: cell.x, width: Math.max(cell.width, 1) }}
          >
            {cell.width >= 10 ? cell.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimelineHeader;
