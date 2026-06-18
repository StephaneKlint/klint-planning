/**
 * lib/domain.ts
 * Pure business logic — no React, no DB, no side effects.
 * Ported from the prototype (gantt.jsx / data.jsx). Testable with Vitest.
 */

import { isWeekend, parseISO, differenceInDays } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhaseStatusCode =
  | "planned"
  | "in_progress"
  | "review"
  | "done"
  | "risk"
  | "late";

export interface PhaseForStatus {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  status: PhaseStatusCode | null;
  progress: number;    // 0..100
}

export interface PlanningStats {
  totalLots: number;
  totalPhases: number;
  totalMilestones: number;
  byStatus: Record<PhaseStatusCode, number>;
  completionPct: number; // average progress across phases
}

export interface MonthlyLoad {
  month: number; // 0-11
  year: number;
  count: number;
  level: "normal" | "loaded" | "overloaded";
}

export interface MilestoneInput {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  labelPos: "auto" | "above" | "below";
}

export interface MilestoneLayoutItem {
  id: string;
  side: "above" | "below";
  level: number;
  centerX: number;
}

export interface DomainCadence {
  livraison: number; // business days before mep
  pmep: number;
  cab: number;
  mep: number;
}

export interface CadencedMilestones {
  livraison: Date;
  pmep: Date;
  cab: Date;
  mep: Date;
}

export interface LotForClosure {
  id: string;
  phases: Array<{
    id: string;
    endDate: string;
    status: PhaseStatusCode | null;
  }>;
  milestones: Array<{
    type: string;
    date: string;
  }>;
}

// ---------------------------------------------------------------------------
// 1. derivePhaseStatus
// ---------------------------------------------------------------------------

/**
 * Derives the effective display status for a phase.
 * - Explicit status (non-null) → returned as-is.
 * - autoLate=true AND end < today AND progress < 100 → "late"
 * - end < today → "done"
 * - start ≤ today ≤ end → "in_progress"
 * - start > today → "planned"
 */
export function derivePhaseStatus(
  phase: PhaseForStatus,
  referenceDate: Date,
  autoLate = true
): PhaseStatusCode {
  if (phase.status !== null && phase.status !== undefined) {
    return phase.status;
  }

  const start = parseISO(phase.startDate);
  const end = parseISO(phase.endDate);
  const today = referenceDate;

  if (autoLate && end < today && phase.progress < 100) return "late";
  if (end < today) return "done";
  if (start <= today && today <= end) return "in_progress";
  return "planned";
}

// ---------------------------------------------------------------------------
// 2. computeStats
// ---------------------------------------------------------------------------

/**
 * Aggregates KPIs for the Synthèse view.
 * Input: flat arrays from DB queries (no nesting required).
 */
export function computeStats(
  lots: { id: string }[],
  phases: { status: PhaseStatusCode | null; startDate: string; endDate: string; progress: number }[],
  milestones: { id: string }[],
  referenceDate: Date,
  autoLate = true
): PlanningStats {
  const byStatus: Record<PhaseStatusCode, number> = {
    planned: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    risk: 0,
    late: 0,
  };

  let totalProgress = 0;

  for (const phase of phases) {
    const effective = derivePhaseStatus(phase, referenceDate, autoLate);
    byStatus[effective] = (byStatus[effective] ?? 0) + 1;
    totalProgress += phase.progress;
  }

  const completionPct =
    phases.length > 0 ? Math.round(totalProgress / phases.length) : 0;

  return {
    totalLots: lots.length,
    totalPhases: phases.length,
    totalMilestones: milestones.length,
    byStatus,
    completionPct,
  };
}

// ---------------------------------------------------------------------------
// 3. workloadFor
// ---------------------------------------------------------------------------

/**
 * Returns monthly workload for a given member.
 * A phase "touches" a month if it overlaps with any day in that month.
 * Thresholds: ≥ 4 = "loaded", ≥ 5 = "overloaded".
 */
export function workloadFor(
  memberId: string,
  phases: Array<{
    id: string;
    startDate: string;
    endDate: string;
    assignees: string[]; // array of member IDs
  }>,
  year: number
): MonthlyLoad[] {
  const result: MonthlyLoad[] = [];

  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // last day

    const count = phases.filter((p) => {
      if (!p.assignees.includes(memberId)) return false;
      const start = parseISO(p.startDate);
      const end = parseISO(p.endDate);
      return start <= monthEnd && end >= monthStart;
    }).length;

    result.push({
      month,
      year,
      count,
      level: count >= 5 ? "overloaded" : count >= 4 ? "loaded" : "normal",
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 4. computeMilestoneLayout
// ---------------------------------------------------------------------------

/**
 * Computes above/below lane assignment for milestone flags.
 * Ported faithfully from prototype's computeMilestoneLanes().
 *
 * Algorithm (V4 from prototype):
 * - Sort milestones by X position.
 * - Alternate above/below for "auto" labelPos.
 * - Respect explicit "above"/"below" — no flip, only stack on collision.
 * - Up to 8 levels per side (3 used in normal view, 8 as hard cap).
 * - Collision detection: right edge of previous label + 3px gap.
 *
 * @param milestones Array of milestones with date, label, labelPos.
 * @param xOf  Pure function: date string → X coordinate in pixels.
 * @returns Array of layout items (parallel to input, same order).
 */
export function computeMilestoneLayout(
  milestones: MilestoneInput[],
  xOf: (date: string) => number,
  forceBelowAll?: boolean
): MilestoneLayoutItem[] {
  if (milestones.length === 0) return [];

  const items = milestones.map((m, i) => {
    const centerX = xOf(m.date);
    const estW = Math.max(24, (m.label || "").length * 5.3 + 14);
    return {
      i,
      id: m.id,
      centerX,
      left: centerX - estW / 2,
      right: centerX + estW / 2,
      forced: m.labelPos,
    };
  });

  const order = [...items].sort((a, b) => a.centerX - b.centerX);
  const tracks: { above: number[]; below: number[] } = { above: [], below: [] };
  const result: MilestoneLayoutItem[] = new Array(milestones.length);
  let alt = 0;

  order.forEach((it) => {
    let primary: "above" | "below";
    let secondary: "above" | "below";
    let allowFlip: boolean;

    if (it.forced === "above" || it.forced === "below") {
      primary = it.forced;
      secondary = primary === "above" ? "below" : "above";
      allowFlip = false;
    } else {
      primary = (forceBelowAll || alt % 2 !== 0) ? "below" : "above";
      secondary = primary === "above" ? "below" : "above";
      allowFlip = true;
      alt++;
    }

    const sides: ("above" | "below")[] = allowFlip
      ? [primary, secondary]
      : [primary];

    let placed = false;
    for (let lvl = 0; !placed && lvl < 3; lvl++) {
      for (const side of sides) {
        const r = tracks[side][lvl];
        if (r === undefined || it.left >= r + 3) {
          tracks[side][lvl] = it.right;
          result[it.i] = { id: it.id, side, level: lvl, centerX: it.centerX };
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      result[it.i] = { id: it.id, side: primary, level: 2, centerX: it.centerX };
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// 5. cadenceMilestones
// ---------------------------------------------------------------------------

/**
 * Adds N business days (Mon–Fri) to a date, skipping weekends.
 * Does NOT account for public holidays (can be added in Jalon 5).
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  const direction = days >= 0 ? 1 : -1;
  const abs = Math.abs(days);
  while (added < abs) {
    result.setDate(result.getDate() + direction);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/**
 * Given the dev end date and the domain cadence config, returns the 4 suggested
 * milestone dates (livraison, pmep, cab, mep) for auto-generation at lot creation.
 *
 * Cadence values = business days after dev end.
 * Example: cadence = { livraison: 0, pmep: 10, cab: 12, mep: 15 }
 *   → livraison = devEndDate + 0 bdays
 *   → pmep      = devEndDate + 10 bdays
 *   → cab       = devEndDate + 12 bdays
 *   → mep       = devEndDate + 15 bdays
 */
export function cadenceMilestones(
  devEndDate: Date,
  cadence: DomainCadence
): CadencedMilestones {
  return {
    livraison: addBusinessDays(devEndDate, cadence.livraison),
    pmep: addBusinessDays(devEndDate, cadence.pmep),
    cab: addBusinessDays(devEndDate, cadence.cab),
    mep: addBusinessDays(devEndDate, cadence.mep),
  };
}

// ---------------------------------------------------------------------------
// 6. applyAutoClosure
// ---------------------------------------------------------------------------

/**
 * If a lot has a MEP milestone whose date is more than `autoCloseAfterMepDays`
 * calendar days in the past, all phases in that lot should be marked "done".
 *
 * Returns the lot IDs that should have their phases auto-closed.
 * The actual DB mutation is done in the Server Action (not here).
 */
export function applyAutoClosure(
  lots: LotForClosure[],
  referenceDate: Date,
  autoCloseAfterMepDays: number
): string[] {
  const toClose: string[] = [];

  for (const lot of lots) {
    const mepMilestones = lot.milestones.filter((m) => m.type === "mep");
    if (mepMilestones.length === 0) continue;

    // Take the latest MEP date for the lot
    const latestMep = mepMilestones.reduce((latest, m) =>
      m.date > latest.date ? m : latest
    );

    const mepDate = parseISO(latestMep.date);
    const daysSinceMep = differenceInDays(referenceDate, mepDate);

    if (daysSinceMep > autoCloseAfterMepDays) {
      // Check if any phase is NOT already done/late
      const hasOpenPhase = lot.phases.some(
        (p) => p.status !== "done" && p.status !== "late"
      );
      if (hasOpenPhase) toClose.push(lot.id);
    }
  }

  return toClose;
}
