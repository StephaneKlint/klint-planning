"use client";
/**
 * DraggableMilestone — wraps MilestoneFlag with horizontal drag + inter-lot.
 * - Drag the diamond → changes date (X) and optionally lot (Y)
 * - Ghost diamond follows cursor (position: fixed)
 * - Original diamond fades to 0.3 opacity during drag
 * - Target lot row highlighted with a blue band
 * - Snap to day. Ctrl+Z via pushUndo("milestone-move").
 */
import { useRef, useState, useEffect } from "react";
import { MilestoneFlag } from "./MilestoneFlag";
import type { MilestoneRow } from "@/lib/db/queries";
import type { RowEntry } from "./types";
import { useOptimisticMilestone } from "@/lib/queries/usePlanning";
import { useGanttStore } from "@/store/ganttStore";
import { moveMilestoneToLot, updateMilestone } from "@/lib/actions/planning";
import { addDays, xOf } from "./ganttUtils";

const MS_DIAMOND = 10;

export interface DraggableMilestoneProps {
  milestone: MilestoneRow;
  planningId: string;
  ppd: number;
  viewStart: string;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  rows: RowEntry[];
  totalW: number;
  // MilestoneFlag display props
  centerX: number;
  rowY: number;
  rowH: number;
  side: "above" | "below";
  level: number;
  color: string;
}

export function DraggableMilestone({
  milestone, planningId, ppd, viewStart,
  bodyRef, rows, totalW,
  centerX, rowY, rowH, side, level, color,
}: DraggableMilestoneProps) {
  const patchMilestone = useOptimisticMilestone();
  const { openEdit, pushUndo, toggleMilestoneSelection, selectedMilestoneIds } = useGanttStore();

  const isSelected = selectedMilestoneIds.has(milestone.id);
  const dimmed = selectedMilestoneIds.size > 0 && !isSelected;

  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos]     = useState<{ x: number; y: number } | null>(null);
  const [targetRow, setTargetRow]   = useState<RowEntry | null>(null);

  const drag = useRef<{
    startClientX: number;
    startScrollLeft: number;
    origDate: string;
    origLotId: string;
    hasMoved: boolean;
    lastDate: string;
    lastLotId: string;
  } | null>(null);

  const getLotAtY = (clientY: number): RowEntry | null => {
    const body = bodyRef.current;
    if (!body) return null;
    const rect = body.getBoundingClientRect();
    const timelineY = clientY - rect.top + body.scrollTop;
    return rows.find((r) => r.kind === "lot" && timelineY >= r.y && timelineY < r.y + r.h) ?? null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const body = bodyRef.current;
    if (!body) return;

    e.preventDefault();
    e.stopPropagation();

    drag.current = {
      startClientX:   e.clientX,
      startScrollLeft: body.scrollLeft,
      origDate:  milestone.date,
      origLotId: milestone.lotId,
      hasMoved:  false,
      lastDate:  milestone.date,
      lastLotId: milestone.lotId,
    };

    document.body.style.cursor    = "grabbing";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!drag.current || !bodyRef.current) return;

      const totalPx = (e.clientX - drag.current.startClientX)
                    + (bodyRef.current.scrollLeft - drag.current.startScrollLeft);

      if (!drag.current.hasMoved && Math.abs(totalPx) < 4) return;

      if (!drag.current.hasMoved) {
        drag.current.hasMoved = true;
        setIsDragging(true);
      }

      // New date from X delta
      const daysDelta = Math.round(totalPx / ppd);
      const newDate = addDays(drag.current.origDate, daysDelta);
      drag.current.lastDate = newDate;

      // Target lot from Y
      const row = getLotAtY(e.clientY);
      drag.current.lastLotId = row?.id ?? drag.current.origLotId;

      setGhostPos({ x: e.clientX, y: e.clientY });
      setTargetRow(row);
    };

    const onMouseUp = () => {
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";

      const d = drag.current;
      drag.current = null;
      setIsDragging(false);
      setGhostPos(null);
      setTargetRow(null);

      if (!d?.hasMoved) return;

      const { origDate, origLotId, lastDate, lastLotId } = d;
      const lotChanged = lastLotId !== origLotId;

      // Optimistic update
      patchMilestone(planningId, milestone.id, { date: lastDate, lotId: lastLotId });

      // Undo entry
      pushUndo({ type: "milestone-move", milestoneId: milestone.id, planningId, prevDate: origDate, prevLotId: origLotId });

      // Server action
      if (lotChanged) {
        moveMilestoneToLot({ milestoneId: milestone.id, targetLotId: lastLotId, newDate: lastDate, planningId })
          .catch(() => patchMilestone(planningId, milestone.id, { date: origDate, lotId: origLotId }));
      } else {
        updateMilestone({ milestoneId: milestone.id, planningId, date: lastDate })
          .catch(() => patchMilestone(planningId, milestone.id, { date: origDate }));
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone.id, milestone.date, milestone.lotId, planningId, ppd, bodyRef, patchMilestone, pushUndo]);

  return (
    <>
      {/* Target lot highlight */}
      {isDragging && targetRow && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: targetRow.y,
            width: totalW,
            height: targetRow.h,
            background: "rgba(59,130,246,0.07)",
            border: "1px dashed rgba(59,130,246,0.35)",
            borderRadius: 3,
            pointerEvents: "none",
            zIndex: 1,
          }}
          aria-hidden
        />
      )}

      {/* Original flag — faded during drag */}
      <MilestoneFlag
        centerX={centerX}
        rowY={rowY}
        rowH={rowH}
        side={side}
        level={level}
        label={milestone.label}
        color={color}
        onClick={isDragging ? undefined : (e) => {
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) {
            toggleMilestoneSelection(milestone.id, true);
          } else {
            openEdit({ kind: "milestone", id: milestone.id });
          }
        }}
        onDiamondMouseDown={handleMouseDown}
        isSelected={isSelected}
        opacity={isDragging ? 0.25 : dimmed ? 0.35 : 1}
      />

      {/* Ghost diamond follows cursor */}
      {isDragging && ghostPos && (
        <div
          style={{
            position: "fixed",
            left: ghostPos.x - MS_DIAMOND / 2,
            top:  ghostPos.y - MS_DIAMOND / 2,
            width:  MS_DIAMOND,
            height: MS_DIAMOND,
            background: color,
            transform: "rotate(45deg)",
            borderRadius: 2,
            pointerEvents: "none",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
          aria-hidden
        />
      )}
    </>
  );
}
