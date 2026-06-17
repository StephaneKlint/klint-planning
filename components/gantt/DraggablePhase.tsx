"use client";
/**
 * DraggablePhase — wraps PhasePill with horizontal drag (move + resize).
 * - move: drag the pill body → shifts startDate + endDate by Δdays
 * - resize-left: drag left edge → changes startDate (min 1 day)
 * - resize-right: drag right edge → changes endDate (min 1 day)
 * Snap to day. Ctrl+Z supported via pushUndo("phase-dates").
 */
import { useRef, useState, useEffect } from "react";
import { PhasePill } from "./PhasePill";
import type { PhaseRow } from "@/lib/db/queries";
import { useOptimisticPhase } from "@/lib/queries/usePlanning";
import { useGanttStore } from "@/store/ganttStore";
import { updatePhaseDates } from "@/lib/actions/planning";
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
  top, height, label, bg, fg, progress, hasNote, selected, editing, dimmed, status,
  onPhaseClick,
}: DraggablePhaseProps) {
  const patchPhase = useOptimisticPhase();
  const { pushUndo } = useGanttStore();

  // Local dates override original during drag (avoids full React Query re-render)
  const [localDates, setLocalDates] = useState<{ start: string; end: string } | null>(null);
  // Cursor zone detected on hover
  const [hoverZone, setHoverZone] = useState<DragMode>("move");

  const drag = useRef<{
    mode: DragMode;
    startClientX: number;
    startScrollLeft: number;
    origStart: string;
    origEnd: string;
    currentStart: string;
    currentEnd: string;
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
      startClientX: e.clientX,
      startScrollLeft: body.scrollLeft,
      origStart: phase.startDate,
      origEnd:   phase.endDate,
      currentStart: phase.startDate,
      currentEnd:   phase.endDate,
      lastDelta: 0,
      hasMoved:  false,
    };

    document.body.style.cursor    = mode === "move" ? "grabbing" : "ew-resize";
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
      if (daysDelta === drag.current.lastDelta) return;
      drag.current.lastDelta = daysDelta;

      const { mode, origStart, origEnd } = drag.current;
      let newStart = origStart;
      let newEnd   = origEnd;

      if (mode === "move") {
        newStart = addDays(origStart, daysDelta);
        newEnd   = addDays(origEnd,   daysDelta);
      } else if (mode === "resize-right") {
        newEnd = addDays(origEnd, daysDelta);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      } else {
        newStart = addDays(origStart, daysDelta);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      }

      drag.current.currentStart = newStart;
      drag.current.currentEnd   = newEnd;
      setLocalDates({ start: newStart, end: newEnd });
    };

    const onMouseUp = () => {
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";

      const d = drag.current;
      drag.current = null;

      if (!d?.hasMoved) {
        setLocalDates(null);
        return;
      }

      const { origStart, origEnd, currentStart, currentEnd } = d;
      // 1. Patch React Query cache FIRST so clearing localDates shows correct data
      patchPhase(planningId, phase.id, { startDate: currentStart, endDate: currentEnd });
      // 2. Clear local visual override
      setLocalDates(null);
      // 3. Undo + persist
      pushUndo({ type: "phase-dates", phaseId: phase.id, planningId, prevStart: origStart, prevEnd: origEnd });
      updatePhaseDates({ phaseId: phase.id, planningId, startDate: currentStart, endDate: currentEnd })
        .catch(() => patchPhase(planningId, phase.id, { startDate: origStart, endDate: origEnd }));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [phase.id, planningId, ppd, bodyRef, patchPhase, pushUndo]);

  return (
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
  );
}
