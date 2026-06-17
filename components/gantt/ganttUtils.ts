import type { RowEntry, ZoomLevel, Density } from "./types";

export const PPD: Record<ZoomLevel, number> = { "1m": 38, "3m": 18, "6m": 9, "12m": 5 };
export const ROW_H: Record<Density, number> = { normal: 44, compact: 36, comfy: 56 };
export const DOMAIN_HEAD_H = 36;
export const PILL_H = 26;
export const MS_DIAMOND = 10;
export const MS_LABEL_H = 14;
export const MS_LANE_H = 18;

export const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const MONTHS_LONG_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function daysSince(date: string, viewStart: string): number {
  return (new Date(date).getTime() - new Date(viewStart).getTime()) / 86400000;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function xOf(date: string, viewStart: string, ppd: number): number {
  return daysSince(date, viewStart) * ppd;
}

export function timelineWidth(viewStart: string, viewEnd: string, ppd: number): number {
  return (daysSince(viewEnd, viewStart) + 1) * ppd;
}

export function isWeekendDay(date: Date): boolean {
  const d = date.getUTCDay();
  return d === 0 || d === 6;
}

/**
 * Greedy interval scheduling: assign overlapping phases to parallel tracks.
 * Returns: trackByPhaseId (phase id → track index 0-based) and numTracks.
 */
export function assignTracks(
  phases: { id: string; startDate: string; endDate: string }[]
): { trackByPhaseId: Record<string, number>; numTracks: number } {
  const sorted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const trackEnds: string[] = []; // last endDate per track
  const trackByPhaseId: Record<string, number> = {};

  for (const phase of sorted) {
    let assigned = false;
    for (let t = 0; t < trackEnds.length; t++) {
      // Track is free if its last phase ends on or before this one starts (adjacent = same day is OK)
      if (trackEnds[t] <= phase.startDate) {
        trackEnds[t] = phase.endDate;
        trackByPhaseId[phase.id] = t;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      trackByPhaseId[phase.id] = trackEnds.length;
      trackEnds.push(phase.endDate);
    }
  }

  return { trackByPhaseId, numTracks: Math.max(1, trackEnds.length) };
}

export function computeRowOffsets(
  domains: { id: string; code: string }[],
  lots: { id: string; domainId: string }[],
  rowH: number,
  domainHeadH = DOMAIN_HEAD_H,
  hiddenLotIds?: Set<string>,
  trackCountByLotId?: Record<string, number>
): { rows: RowEntry[]; totalH: number } {
  const rows: RowEntry[] = [];
  let y = 0;
  for (const domain of domains) {
    const domainLots = lots.filter((l) => l.domainId === domain.id);
    // Cache le header du domaine si TOUS ses lots sont masqués
    // (domaine sans lot = header toujours visible pour permettre d'en créer)
    const allHidden =
      domainLots.length > 0 &&
      hiddenLotIds != null &&
      domainLots.every((l) => hiddenLotIds.has(l.id));

    if (!allHidden) {
      rows.push({ kind: "domain", id: domain.id, domainCode: domain.code, y, h: domainHeadH });
      y += domainHeadH;
    }

    for (const lot of domainLots) {
      if (hiddenLotIds?.has(lot.id)) continue;
      const tracks = trackCountByLotId?.[lot.id] ?? 1;
      const h = tracks * rowH;
      rows.push({ kind: "lot", id: lot.id, domainCode: domain.code, y, h });
      y += h;
    }
  }
  return { rows, totalH: y };
}

/** Build month segments: [{month, year, x, width}] for the timeline header. */
export function buildMonthSegments(viewStart: string, viewEnd: string, ppd: number) {
  const segments: { month: number; year: number; x: number; width: number }[] = [];
  const start = new Date(viewStart + "T00:00:00Z");
  const end = new Date(viewEnd + "T00:00:00Z");

  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const nextMonth = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    const segStart = cur < start ? start : cur;
    const segEnd = nextMonth > end ? new Date(end.getTime() + 86400000) : nextMonth;
    const x = xOf(segStart.toISOString().slice(0, 10), viewStart, ppd);
    const width = (segEnd.getTime() - segStart.getTime()) / 86400000 * ppd;
    segments.push({ month: cur.getUTCMonth(), year: cur.getUTCFullYear(), x, width });
    cur = nextMonth;
  }
  return segments;
}

/** Build day cells for second header row. Show every day for 1m/3m, every Mon for 6m/12m. */
export function buildDayCells(viewStart: string, viewEnd: string, ppd: number, zoom: ZoomLevel) {
  const cells: { label: string; x: number; width: number; isMajor: boolean }[] = [];
  const start = new Date(viewStart + "T00:00:00Z");
  const end = new Date(viewEnd + "T00:00:00Z");
  const step = zoom === "12m" || zoom === "6m" ? 7 : 1;

  // Align to Monday for week view
  let cur = new Date(start);
  if (step === 7) {
    const dow = cur.getUTCDay();
    const toMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + toMon));
  }

  while (cur <= end) {
    const x = xOf(cur.toISOString().slice(0, 10), viewStart, ppd);
    const label = step === 7
      ? `S${isoWeek(cur)} ${cur.getUTCDate()}/${cur.getUTCMonth() + 1}`
      : String(cur.getUTCDate());
    const isMajor = cur.getUTCDate() === 1;
    cells.push({ label, x, width: step * ppd, isMajor });
    cur = new Date(cur.getTime() + step * 86400000);
  }
  return cells;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Build weekend bands: [{x, width}] */
export function buildWeekendBands(viewStart: string, viewEnd: string, ppd: number) {
  const bands: { x: number; width: number }[] = [];
  const start = new Date(viewStart + "T00:00:00Z");
  const end = new Date(viewEnd + "T00:00:00Z");
  let cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow === 6) {
      const x = xOf(cur.toISOString().slice(0, 10), viewStart, ppd);
      bands.push({ x, width: 2 * ppd });
    }
    cur = new Date(cur.getTime() + 86400000);
  }
  return bands;
}

export function todayScrollLeft(today: string, viewStart: string, ppd: number, containerW: number): number {
  return Math.max(0, xOf(today, viewStart, ppd) - containerW * 0.3);
}
