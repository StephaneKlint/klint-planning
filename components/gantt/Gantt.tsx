"use client";
/**
 * Gantt — main container.
 * - Synchronises vertical scroll (side ↔ body)
 * - Synchronises horizontal scroll (header ↔ body)
 * - Re-centers on Today when zoom changes
 */
import { useRef, useEffect, useCallback } from "react";
import { useGanttStore } from "@/store/ganttStore";
import { GanttSide } from "./GanttSide";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineBody } from "./TimelineBody";
import type { GanttProps } from "./types";
import type { StatusCode } from "@/components/ui/StatusPill";
import {
  PPD, ROW_H, computeRowOffsets, timelineWidth, todayScrollLeft,
} from "./ganttUtils";
import { derivePhaseStatus } from "@/lib/domain";
import styles from "./Gantt.module.css";

const SIDE_W = 340;
const HEADER_H = 52; // monthsRow (30) + daysRow (22)

export function Gantt({
  planningId: _planningId, // eslint-disable-line @typescript-eslint/no-unused-vars
  domains,
  lots,
  phases,
  milestones,
  milestoneTypes,
  statuses,
  phaseAssignees,
  phaseTypes: _phaseTypes, // eslint-disable-line @typescript-eslint/no-unused-vars
  members: _members, // eslint-disable-line @typescript-eslint/no-unused-vars
  viewStart,
  viewEnd,
  referenceDate,
}: GanttProps) {
  const { zoom, density, colorMode, showWeekends, showDomainBands } = useGanttStore();

  const ppd = PPD[zoom];
  const rowH = ROW_H[density];
  const { rows, totalH } = computeRowOffsets(domains, lots, rowH);
  const totalW = timelineWidth(viewStart, viewEnd, ppd);

  // Refs for scroll sync
  const sideRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // Vertical sync: body → side
  const onBodyScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (sideRef.current && bodyRef.current) {
      sideRef.current.scrollTop = bodyRef.current.scrollTop;
    }
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.addEventListener("scroll", onBodyScroll, { passive: true });
    return () => body.removeEventListener("scroll", onBodyScroll);
  }, [onBodyScroll]);

  // Re-center on Today when zoom changes
  useEffect(() => {
    const body = bodyRef.current;
    const header = headerRef.current;
    if (!body) return;
    const containerW = body.clientWidth || 800;
    const target = todayScrollLeft(referenceDate, viewStart, ppd, containerW);
    body.scrollLeft = target;
    if (header) header.scrollLeft = target;
  }, [zoom, ppd, referenceDate, viewStart]);

  // Derive lot-level stats
  const phasesByLot = phases.reduce<Record<string, typeof phases>>((acc, p) => {
    (acc[p.lotId] ??= []).push(p);
    return acc;
  }, {});

  const lotProgress: Record<string, number> = {};
  const lotStatus: Record<string, StatusCode> = {};
  const today = new Date(referenceDate);

  for (const lot of lots) {
    const lotPhases = phasesByLot[lot.id] ?? [];
    if (lotPhases.length === 0) {
      lotProgress[lot.id] = 0;
      lotStatus[lot.id] = "planned";
      continue;
    }
    const avg = Math.round(lotPhases.reduce((s, p) => s + p.progress, 0) / lotPhases.length);
    lotProgress[lot.id] = avg;

    // Derive lot status from phases
    const derived = lotPhases.map((p) =>
      derivePhaseStatus(
        { startDate: p.startDate, endDate: p.endDate, status: p.status as StatusCode | null, progress: p.progress },
        today
      )
    );
    if (derived.some((s) => s === "late")) lotStatus[lot.id] = "late";
    else if (derived.some((s) => s === "risk")) lotStatus[lot.id] = "risk";
    else if (derived.every((s) => s === "done")) lotStatus[lot.id] = "done";
    else if (derived.some((s) => s === "in_progress")) lotStatus[lot.id] = "in_progress";
    else if (derived.some((s) => s === "review")) lotStatus[lot.id] = "review";
    else lotStatus[lot.id] = "planned";
  }

  return (
    <div className={styles.gantt}>
      {/* LEFT — Side panel */}
      <div
        ref={sideRef}
        className={styles.sideScroll}
        style={{ width: SIDE_W, minWidth: SIDE_W }}
      >
        <GanttSide
          rows={rows}
          totalH={totalH}
          domains={domains}
          lots={lots}
          lotProgress={lotProgress}
          lotStatus={lotStatus}
          width={SIDE_W}
        />
      </div>

      {/* RIGHT — Timeline */}
      <div className={styles.timelineWrapper}>
        {/* Header row (scrolls horizontally) */}
        <div
          ref={headerRef}
          className={styles.headerScroll}
          style={{ height: HEADER_H }}
        >
          <TimelineHeader
            viewStart={viewStart}
            viewEnd={viewEnd}
            ppd={ppd}
            zoom={zoom}
            totalW={totalW}
          />
        </div>

        {/* Body (scrolls both) */}
        <div ref={bodyRef} className={styles.bodyScroll}>
          <TimelineBody
            rows={rows}
            totalH={totalH}
            totalW={totalW}
            domains={domains}
            lots={lots}
            phases={phases}
            milestones={milestones}
            milestoneTypes={milestoneTypes}
            statuses={statuses}
            phaseAssignees={phaseAssignees}
            viewStart={viewStart}
            ppd={ppd}
            referenceDate={referenceDate}
            colorMode={colorMode}
            showWeekends={showWeekends}
            showDomainBands={showDomainBands}
            viewStart2={viewStart}
            viewEnd={viewEnd}
          />
        </div>
      </div>
    </div>
  );
}

export default Gantt;
