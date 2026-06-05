"use client";
/**
 * TimelineBody — the scrollable Gantt content area.
 * Renders: weekend bands, domain bands, phase pills, milestones, today line.
 * Uses absolute positioning (same rowOffsets as GanttSide).
 */
import type { RowEntry, ColorMode } from "./types";
import type { DomainRow, LotRow, PhaseRow, MilestoneRow, MilestoneTypeRow, StatusRow } from "@/lib/db/queries";
import { PhasePill } from "./PhasePill";
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
  viewStart: string;
  ppd: number;
  referenceDate: string;
  colorMode: ColorMode;
  showWeekends: boolean;
  showDomainBands: boolean;
  viewStart2: string;
  viewEnd: string;
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
  viewStart,
  ppd,
  referenceDate,
  colorMode,
  showWeekends,
  showDomainBands,
  viewEnd,
}: TimelineBodyProps) {
  const { togglePhaseSelection, selectedPhaseIds, openEdit } = useGanttStore();
  const domainById = Object.fromEntries(domains.map((d) => [d.id, d]));
  const lotById = Object.fromEntries(lots.map((l) => [l.id, l]));
  const statusByCode = Object.fromEntries(statuses.map((s) => [s.code, s]));
  const msTypeByCode = Object.fromEntries(milestoneTypes.map((t) => [t.code, t]));

  // Fallback labels quand phase.label est null : type code → libellé affiché
  const PHASE_TYPE_LABELS: Record<string, string> = {
    cadrage: "Cadrage", dev: "Développement", recette: "Recette",
    formation: "Formation", custom: "Personnalisé",
  };
  const phaseLabel = (phase: PhaseRow) =>
    phase.label ?? PHASE_TYPE_LABELS[phase.type] ?? phase.type;

  const phasesByLot = phases.reduce<Record<string, PhaseRow[]>>((acc, p) => {
    (acc[p.lotId] ??= []).push(p);
    return acc;
  }, {});

  const milestonesByLot = milestones.reduce<Record<string, MilestoneRow[]>>((acc, m) => {
    (acc[m.lotId] ??= []).push(m);
    return acc;
  }, {});

  const weekendBands = showWeekends ? buildWeekendBands(viewStart, viewEnd, ppd) : [];
  const todayX = xOf(referenceDate, viewStart, ppd);

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
      {rows.map((row) => {
        if (row.kind !== "lot") return null;
        const lot = lotById[row.id];
        if (!lot) return null;
        const domain = domainById[lot.domainId];
        const lotPhases = phasesByLot[row.id] ?? [];
        const lotMilestones = milestonesByLot[row.id] ?? [];

        // Phase pills
        const pills = lotPhases.map((phase) => {
          const left = xOfDate(phase.startDate);
          const right = xOfDate(phase.endDate);
          const width = right - left;
          const pillTop = row.y + Math.floor((row.h - PILL_H) / 2);

          // Resolve color
          let bg = phase.color ?? domain?.phaseColor ?? "#6B7280";
          let fg = "#ffffff";
          if (colorMode === "status" && phase.status) {
            const s = statusByCode[phase.status];
            if (s) { bg = s.bg; fg = s.color; }
          }

          const isSelected = selectedPhaseIds.has(phase.id);
          // Dim non-selected when a selection is active
          const dimmed = selectedPhaseIds.size > 0 && !isSelected;

          return (
            <PhasePill
              key={phase.id}
              left={left}
              width={width}
              top={pillTop}
              height={PILL_H}
              label={phaseLabel(phase)}
              progress={phase.progress}
              bg={bg}
              fg={fg}
              hasNote={!!phase.note}
              selected={isSelected}
              dimmed={dimmed}
              onClick={(e) => togglePhaseSelection(phase.id, e.metaKey || e.ctrlKey)}
            />
          );
        });

        // Milestone layout
        const msInputs = lotMilestones.map((m) => ({
          id: m.id,
          date: m.date,
          label: m.label,
          labelPos: m.labelPos as "auto" | "above" | "below",
        }));
        const msLayout = computeMilestoneLayout(msInputs, xOfDate);

        const flags = msLayout.map((layout, i) => {
          const ms = lotMilestones[i];
          const msType = msTypeByCode[ms.type];
          const color = ms.color ?? msType?.color ?? "#7C3AED";
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
            {pills}
            {flags}
          </div>
        );
      })}

      {/* Today line */}
      {todayX >= 0 && todayX <= totalW && (
        <TodayLine x={todayX} totalH={totalH} date={referenceDate} />
      )}
    </div>
  );
}

export default TimelineBody;
