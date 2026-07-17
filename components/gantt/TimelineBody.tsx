"use client";
/**
 * TimelineBody — the scrollable Gantt content area.
 * Renders: weekend bands, domain bands, phase pills, milestones, today line.
 * Uses absolute positioning (same rowOffsets as GanttSide).
 */
import React from "react";
import type { RowEntry, ColorMode } from "./types";
import type { DomainRow, LotRow, PhaseRow, MilestoneRow, MilestoneTypeRow, StatusRow, MemberRow, ClosurePeriodRow } from "@/lib/db/queries";
import { DraggablePhase } from "./DraggablePhase";
import { DraggableMilestone } from "./DraggableMilestone";
import { MilestoneFlag } from "./MilestoneFlag";
import { TodayLine } from "./TodayLine";
import { computeMilestoneLayout } from "@/lib/domain";
import { useGanttStore } from "@/store/ganttStore";
import {
  xOf, PILL_H, buildWeekendBands,
} from "./ganttUtils";
import styles from "./TimelineBody.module.css";

interface TimelineBodyProps {
  rows: RowEntry[];
  totalH: number;
  totalW: number;
  domains: DomainRow[];
  lots: LotRow[];
  phases: PhaseRow[];
  milestones: MilestoneRow[];
  milestoneTypes: MilestoneTypeRow[];
  statuses: StatusRow[];
  phaseAssignees: { phaseId: string; memberId: string }[];
  members: MemberRow[];
  viewStart: string;
  ppd: number;
  referenceDate: string;
  colorMode: ColorMode;
  showWeekends: boolean;
  showDomainBands: boolean;
  viewStart2: string;
  viewEnd: string;
  closurePeriods?: ClosurePeriodRow[];
  showHolidays?: boolean;
  showClosures?: boolean;
  /** phase id → track index (0 = top track) — from assignTracks in Gantt.tsx */
  trackByPhaseId?: Record<string, number>;
  /** base row height (single track) — needed for pill Y calculation */
  rowH?: number;
  planningId?: string;
  bodyRef?: React.RefObject<HTMLDivElement | null>;
  headerRef?: React.RefObject<HTMLDivElement | null>;
  onBulkMoveComplete?: (deltaDays: number, targetLotId: string) => void;
}

export function TimelineBody({
  rows,
  totalH,
  totalW,
  domains,
  lots,
  phases,
  milestones,
  milestoneTypes,
  statuses,
  phaseAssignees,
  members,
  viewStart,
  ppd,
  referenceDate,
  colorMode,
  showWeekends,
  showDomainBands,
  viewEnd,
  closurePeriods,
  showHolidays = true,
  showClosures = true,
  trackByPhaseId = {},
  rowH: singleRowH = 44,
  planningId,
  bodyRef,
  headerRef,
  onBulkMoveComplete,
}: TimelineBodyProps) {
  const { togglePhaseSelection, selectedPhaseIds, openEdit, editTarget, baselinePhases, showBaseline } = useGanttStore();
  const domainById = Object.fromEntries(domains.map((d) => [d.id, d]));
  const lotById = Object.fromEntries(lots.map((l) => [l.id, l]));
  const statusByCode = Object.fromEntries(statuses.map((s) => [s.code, s]));
  // Pre-compute first assignee color per phase for "person" color mode
  const memberColorById = Object.fromEntries(members.map((m) => [m.id, m.color ?? "#6B7280"]));
  const firstAssigneeColorByPhaseId: Record<string, string> = {};
  for (const a of phaseAssignees) {
    if (!firstAssigneeColorByPhaseId[a.phaseId]) {
      firstAssigneeColorByPhaseId[a.phaseId] = memberColorById[a.memberId] ?? "#6B7280";
    }
  }
  const msTypeByCode = Object.fromEntries(milestoneTypes.map((t) => [t.code, t]));

  // Fallback labels quand phase.label est null : type code → libellé affiché
  const PHASE_TYPE_LABELS: Record<string, string> = {
    cadrage: "Cadrage", dev: "Développement", recette: "Recette",
    formation: "Formation", custom: "Personnalisé",
  };
  const phaseLabel = (phase: PhaseRow) =>
    phase.label ?? PHASE_TYPE_LABELS[phase.type] ?? phase.type;

  // Only render phases/milestones that overlap [viewStart, viewEnd]
  const phasesByLot = phases
    .filter((p) => p.startDate <= viewEnd && p.endDate >= viewStart)
    .reduce<Record<string, PhaseRow[]>>((acc, p) => {
      (acc[p.lotId] ??= []).push(p);
      return acc;
    }, {});

  const milestonesByLot = milestones
    .filter((m) => m.date >= viewStart && m.date <= viewEnd)
    .reduce<Record<string, MilestoneRow[]>>((acc, m) => {
      (acc[m.lotId] ??= []).push(m);
      return acc;
    }, {});

  const weekendBands = showWeekends ? buildWeekendBands(viewStart, viewEnd, ppd) : [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayX = xOf(todayStr, viewStart, ppd);

  const xOfDate = (date: string) => xOf(date, viewStart, ppd);

  return (
    <div
      className={styles.body}
      style={{ width: totalW, height: totalH, position: "relative" }}
      aria-label="Timeline du planning"
    >
      {/* Weekend bands */}
      {weekendBands.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x,
            top: 0,
            width: b.width,
            height: totalH,
            background: "rgba(0,0,0,0.025)",
            pointerEvents: "none",
            zIndex: 0,
          }}
          aria-hidden
        />
      ))}

      {/* Closure period bands — fermetures et jours fériés */}
      {closurePeriods
        ?.filter((cp) => {
          if (!cp.active) return false;
          if (cp.type === "holiday" && !showHolidays) return false;
          if (cp.type === "custom" && !showClosures) return false;
          // Must overlap the view range
          return cp.endDate >= viewStart && cp.startDate <= viewEnd;
        })
        .map((cp) => {
          const startClamped = cp.startDate < viewStart ? viewStart : cp.startDate;
          const x1 = xOf(startClamped, viewStart, ppd);
          // +1 day so the last day is fully covered
          const dayAfterEnd = new Date(cp.endDate);
          dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
          const endStr = dayAfterEnd.toISOString().slice(0, 10);
          const x2 = xOf(endStr, viewStart, ppd);
          const width = Math.max(4, x2 - x1);
          return (
            <div
              key={`cp-${cp.id}`}
              style={{
                position: "absolute",
                left: x1,
                top: 0,
                width,
                height: totalH,
                background: cp.color,
                opacity: 0.4,
                pointerEvents: "none",
                zIndex: 0,
              }}
              title={cp.label}
              aria-hidden
            />
          );
        })}

      {/* Domain band backgrounds */}
      {showDomainBands &&
        rows.map((row) => {
          if (row.kind !== "lot") return null;
          const lot = lotById[row.id];
          if (!lot) return null;
          const domain = domainById[lot.domainId];
          if (!domain) return null;
          return (
            <div
              key={`band-${row.id}`}
              style={{
                position: "absolute",
                left: 0,
                top: row.y,
                width: totalW,
                height: row.h,
                background: domain.bg,
                opacity: 0.35,
                pointerEvents: "none",
                zIndex: 0,
              }}
              aria-hidden
            />
          );
        })}

      {/* Domain header lines */}
      {rows.map((row) => {
        if (row.kind !== "domain") return null;
        const domain = domains.find((d) => d.id === row.id);
        if (!domain) return null;
        return (
          <div
            key={`dh-${row.id}`}
            style={{
              position: "absolute",
              left: 0,
              top: row.y,
              width: totalW,
              height: row.h,
              background: domain.bg,
              borderBottom: `1px solid ${domain.strong}33`,
              zIndex: 1,
              pointerEvents: "none",
            }}
            aria-hidden
          />
        );
      })}

      {/* Horizontal lot row separators */}
      {rows.map((row) => {
        if (row.kind !== "lot") return null;
        return (
          <div
            key={`sep-${row.id}`}
            style={{
              position: "absolute",
              left: 0,
              top: row.y + row.h - 1,
              width: totalW,
              height: 1,
              background: "var(--klint-line, #E6E8EE)",
              zIndex: 1,
              pointerEvents: "none",
            }}
            aria-hidden
          />
        );
      })}

      {/* Phases + Milestones per lot */}
      {rows.map((row, rowIdx) => {
        if (row.kind !== "lot") return null;
        const lot = lotById[row.id];
        if (!lot) return null;
        const domain = domainById[lot.domainId];
        const lotPhases = phasesByLot[row.id] ?? [];
        const lotMilestones = milestonesByLot[row.id] ?? [];

        // Phase pills
        const pills = lotPhases.map((phase) => {
          const left = xOfDate(phase.startDate);
          const right = xOfDate(phase.endDate) + ppd; // endDate inclusive: extend to end of day
          const width = right - left;
          // Multi-track: each track occupies singleRowH, pill centered within its track
          const track = trackByPhaseId[phase.id] ?? 0;
          const pillTop = row.y + track * singleRowH + Math.floor((singleRowH - PILL_H) / 2);

          // Resolve color based on current color mode
          let bg = phase.color ?? domain?.phaseColor ?? "#6B7280";
          let fg = "#ffffff";
          if (colorMode === "status" && phase.status) {
            const s = statusByCode[phase.status];
            if (s) { bg = s.bg; fg = s.color; }
          } else if (colorMode === "person") {
            bg = firstAssigneeColorByPhaseId[phase.id] ?? (phase.color ?? domain?.phaseColor ?? "#6B7280");
          }

          const isSelected = selectedPhaseIds.has(phase.id);
          const isEditing = editTarget?.kind === "phase" && editTarget.id === phase.id;
          // Dim non-selected when a selection is active
          const dimmed = selectedPhaseIds.size > 0 && !isSelected;

          const bSnap = showBaseline && baselinePhases ? baselinePhases[phase.id] : null;
          const bLeft  = bSnap ? xOfDate(bSnap.startDate) : 0;
          const bRight = bSnap ? xOfDate(bSnap.endDate) + ppd : 0; // endDate inclusive
          const bWidth = Math.max(bRight - bLeft, 4);
          const bChanged = bSnap && (bSnap.startDate !== phase.startDate || bSnap.endDate !== phase.endDate);

          return (
            <React.Fragment key={phase.id}>
              {planningId && bodyRef ? (
                <DraggablePhase
                  phase={phase}
                  planningId={planningId}
                  ppd={ppd}
                  viewStart={viewStart}
                  bodyRef={bodyRef}
                  headerRef={headerRef}
                  rows={rows}
                  totalW={totalW}
                  top={pillTop}
                  height={PILL_H}
                  label={phaseLabel(phase)}
                  bg={bg}
                  fg={fg}
                  progress={phase.progress}
                  hasNote={!!phase.note}
                  selected={isSelected}
                  editing={isEditing}
                  dimmed={dimmed}
                  status={phase.status}
                  onPhaseClick={(e) => togglePhaseSelection(phase.id, e.metaKey || e.ctrlKey)}
                  onBulkMoveComplete={onBulkMoveComplete}
                />
              ) : null}
              {bSnap && bChanged && (
                <div
                  style={{
                    position: "absolute",
                    left: bLeft,
                    width: bWidth,
                    top: pillTop + PILL_H + 1,
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(59,130,246,0.55)",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                  title={`Baseline : ${bSnap.startDate} → ${bSnap.endDate}`}
                />
              )}
            </React.Fragment>
          );
        });

        // Milestone layout — force flags below when a domain header sits directly above this lot
        const isDomainFirstLot = rows[rowIdx - 1]?.kind === "domain";
        const msInputs = lotMilestones.map((m) => ({
          id: m.id,
          date: m.date,
          label: m.label,
          labelPos: m.labelPos as "auto" | "above" | "below",
        }));
        const xOfDateMid = (date: string) => xOfDate(date) + ppd / 2; // center in day column
        const msLayout = computeMilestoneLayout(msInputs, xOfDateMid, isDomainFirstLot);

        const flags = msLayout.map((layout, i) => {
          const ms = lotMilestones[i];
          const msType = msTypeByCode[ms.type];
          const color = ms.color ?? msType?.color ?? "#7C3AED";
          if (planningId && bodyRef) {
            return (
              <DraggableMilestone
                key={ms.id}
                milestone={ms}
                planningId={planningId}
                ppd={ppd}
                viewStart={viewStart}
                bodyRef={bodyRef}
                rows={rows}
                totalW={totalW}
                centerX={layout.centerX}
                rowY={row.y}
                rowH={row.h}
                side={layout.side}
                level={layout.level}
                color={color}
                onBulkMoveComplete={onBulkMoveComplete}
              />
            );
          }
          return (
            <MilestoneFlag
              key={ms.id}
              centerX={layout.centerX}
              rowY={row.y}
              rowH={row.h}
              side={layout.side}
              onClick={(e) => { e.stopPropagation(); openEdit({ kind: "milestone", id: ms.id }); }}
              level={layout.level}
              label={ms.label}
              color={color}
            />
          );
        });

        return (
          <div key={`lot-${row.id}`} style={{ position: "absolute", top: 0, left: 0, width: totalW, height: totalH, pointerEvents: "none" }}>
            {/* Dim pills when postponed */}
            <div style={{ opacity: lot.isPostponed ? 0.4 : 1 }}>
              {pills}
            </div>

            {/* Lot reporté — hachures ambre 135° + label flottant */}
            {lot.isPostponed && (
              <>
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: row.y,
                  width: totalW,
                  height: row.h,
                  background: "repeating-linear-gradient(135deg, rgba(217,119,6,0.08) 0px, rgba(217,119,6,0.08) 6px, transparent 6px, transparent 14px)",
                  borderTop: "1.5px solid rgba(217,119,6,0.22)",
                  borderBottom: "1.5px solid rgba(217,119,6,0.22)",
                  zIndex: 2,
                  pointerEvents: "none",
                }} />
                {lot.postponedNote && (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: row.y,
                    width: totalW,
                    height: row.h,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 3,
                    pointerEvents: "none",
                  }}>
                    <span style={{
                      background: "rgba(255,255,255,0.90)",
                      border: `1.5px solid ${lot.postponedLabelColor ?? "#D97706"}`,
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: `${lot.postponedLabelSize ?? 12}px`,
                      fontFamily: lot.postponedLabelFont ?? "var(--font-display, system-ui)",
                      color: lot.postponedLabelColor ?? "#D97706",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}>
                      {lot.postponedNote}
                    </span>
                  </div>
                )}
              </>
            )}

            {flags}
          </div>
        );
      })}

      {/* Today line */}
      {todayX >= 0 && todayX <= totalW && (
        <TodayLine x={todayX} totalH={totalH} date={todayStr} />
      )}
    </div>
  );
}

export default TimelineBody;
