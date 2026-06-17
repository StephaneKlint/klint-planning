"use client";
/**
 * DraggablePhase — wraps PhasePill with horizontal drag (move + resize) + inter-lot move.
 * - move: drag pill body → shifts dates by Δdays; dragging vertically changes target lot
 * - resize-left / resize-right: changes startDate / endDate (same lot only)
 * Snap to day. Ctrl+Z via pushUndo("phase-dates" | "phase-move").
 */
import { useRef, useState, useEffect } from "react";
import { PhasePill } from "./PhasePill";
import type { PhaseRow } from "@/lib/db/queries";
import type { RowEntry } from "./types";
import { useOptimisticPhase } from "@/lib/queries/usePlanning";
import { useGanttStore } from "@/store/ganttStore";
import { updatePhaseDates, movePhaseToLot } from "@/lib/actions/planning";
import { addDays, xOf } from "./ganttUtils";

type DragMode = "move" | "resize-left" | "resize-right";
const HANDLE_PX = 10;

export interface DraggablePhaseProps {
  phase: PhaseRow;
  planningId: string;
  ppd: number;
  viewStart: string;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  headerRef?: React.RefObject<HTMLDivElement | null>;
  rows: RowEntry[];
  totalW: number;
  top: number;
  height: number;
  label: string | null;
  bg: string;
  fg: string;
  progress: number;
  hasNote: boolean;
  selected: boolean;
  editing: boolean;
  dimmed: boolean;
  status: string | null;
  onPhaseClick: (e: React.MouseEvent) => void;
}

export function DraggablePhase({
  phase, planningId, ppd, viewStart,
  bodyRef, headerRef,
  rows, totalW,
  top, height, label, bg, fg, progress, hasNote, selected, editing, dimmed, status,
  onPhaseClick,
}: DraggablePhaseProps) {
  const patchPhase = useOptimisticPhase();
  const { pushUndo } = useGanttStore();

  const [localDates, setLocalDates] = useState<{ start: string; end: string } | null>(null);
  const [hoverZone, setHoverZone] = useState<DragMode>("move");
  const [targetRow, setTargetRow] = useState<RowEntry | null>(null);

  // Keep latest rows accessible inside the stable useEffect closure
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const drag = useRef<{
    mode: DragMode;
    startClientX: number;
    startScrollLeft: number;
    origStart: string;
    origEnd: string;
    origLotId: string;
    currentStart: string;
    currentEnd: string;
    currentLotId: string;
    lastDelta: number;
    hasMoved: boolean;
  } | null>(null);

  const isDragging = localDates !== null;

  const displayStart = localDates?.start ?? phase.startDate;
  const displayEnd   = localDates?.end   ?? phase.endDate;
  const left  = xOf(displayStart, viewStart, ppd);
  const right = xOf(displayEnd,   viewStart, ppd);
  const width = Math.max(ppd, right - left);

  const getZone = (localX: number, pillW: number): DragMode => {
    const h = Math.min(HANDLE_PX, pillW * 0.2);
    if (localX <= h) return "resize-left";
    if (localX >= pillW - h) return "resize-right";
    return "move";
  };

  const getCursor = (): React.CSSProperties["cursor"] => {
    if (isDragging) return drag.current?.mode === "move" ? "grabbing" : "ew-resize";
    if (hoverZone !== "move") return "ew-resize";
    return "grab";
  };

  const getLotAtY = (clientY: number): RowEntry | null => {
    const body = bodyRef.current;
    if (!body) return null;
    const rect = body.getBoundingClientRect();
    const timelineY = clientY - rect.top + body.scrollTop;
    return rowsRef.current.find((r) => r.kind === "lot" && timelineY >= r.y && timelineY < r.y + r.h) ?? null;
  };

  const handleMouseMove_local = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverZone(getZone(e.clientX - rect.left, rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const body = bodyRef.current;
    if (!body) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mode = getZone(e.clientX - rect.left, rect.width);

    e.preventDefault();
    e.stopPropagation();

    drag.current = {
      mode,
      startClientX:   e.clientX,
      startScrollLeft: body.scrollLeft,
      origStart:  phase.startDate,
      origEnd:    phase.endDate,
      origLotId:  phase.lotId,
      currentStart:  phase.startDate,
      currentEnd:    phase.endDate,
      currentLotId:  phase.lotId,
      lastDelta:  0,
      hasMoved:   false,
    };

    document.body.style.cursor     = mode === "move" ? "grabbing" : "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!drag.current || !bodyRef.current) return;

      const totalPx = (e.clientX - drag.current.startClientX)
                    + (bodyRef.current.scrollLeft - drag.current.startScrollLeft);

      if (!drag.current.hasMoved && Math.abs(totalPx) < 4) return;
      drag.current.hasMoved = true;

      const daysDelta = Math.round(totalPx / ppd);
      const { mode, origStart, origEnd } = drag.current;
      let newStart = origStart;
      let newEnd   = origEnd;

      if (mode === "move") {
        newStart = addDays(origStart, daysDelta);
        newEnd   = addDays(origEnd,   daysDelta);
        // Inter-lot: detect target lot from cursor Y
        const row = getLotAtY(e.clientY);
        drag.current.currentLotId = row?.id ?? drag.current.origLotId;
        setTargetRow(row);
      } else if (mode === "resize-right") {
        newEnd = addDays(origEnd, daysDelta);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      } else {
        newStart = addDays(origStart, daysDelta);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      }

      if (daysDelta !== drag.current.lastDelta || mode === "move") {
        drag.current.lastDelta   = daysDelta;
        drag.current.currentStart = newStart;
        drag.current.currentEnd   = newEnd;
        setLocalDates({ start: newStart, end: newEnd });
      }
    };

    const onMouseUp = () => {
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";

      const d = drag.current;
      drag.current = null;
      setTargetRow(null);

      if (!d?.hasMoved) {
        setLocalDates(null);
        return;
      }

      const { origStart, origEnd, origLotId, currentStart, currentEnd, currentLotId } = d;
      const lotChanged = currentLotId !== origLotId;

      // 1. Patch React Query cache FIRST
      patchPhase(planningId, phase.id, {
        startDate: currentStart, endDate: currentEnd,
        ...(lotChanged ? { lotId: currentLotId } : {}),
      });
      // 2. Clear local override
      setLocalDates(null);

      if (lotChanged) {
        // 3a. Undo inter-lot move
        pushUndo({ type: "phase-move", phaseId: phase.id, planningId, prevStart: origStart, prevEnd: origEnd, prevLotId: origLotId });
        movePhaseToLot({ phaseId: phase.id, planningId, targetLotId: currentLotId, newStartDate: currentStart, newEndDate: currentEnd })
          .catch(() => patchPhase(planningId, phase.id, { startDate: origStart, endDate: origEnd, lotId: origLotId }));
      } else {
        // 3b. Undo intra-lot move / resize
        pushUndo({ type: "phase-dates", phaseId: phase.id, planningId, prevStart: origStart, prevEnd: origEnd });
        updatePhaseDates({ phaseId: phase.id, planningId, startDate: currentStart, endDate: currentEnd })
          .catch(() => patchPhase(planningId, phase.id, { startDate: origStart, endDate: origEnd }));
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [phase.id, planningId, ppd, bodyRef, patchPhase, pushUndo]);

  return (
    <>
      {/* Target lot highlight — shown only when dragging "move" to a different lot */}
      {isDragging && targetRow && targetRow.id !== phase.lotId && (
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
      <PhasePill
        left={left}
        width={width}
        top={top}
        height={height}
        label={label}
        startDate={displayStart}
        endDate={displayEnd}
        progress={progress}
        bg={bg}
        fg={fg}
        hasNote={hasNote}
        selected={selected}
        editing={editing}
        dimmed={dimmed}
        status={status}
        dragging={isDragging}
        cursor={getCursor()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove_local}
        onMouseLeave_={() => { if (!isDragging) setHoverZone("move"); }}
        onClick={isDragging ? undefined : onPhaseClick}
      />
    </>
  );
}
